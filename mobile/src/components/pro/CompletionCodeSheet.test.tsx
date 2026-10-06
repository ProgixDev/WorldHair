import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AxiosError, AxiosHeaders } from "axios";
import React from "react";

import { getPresenceStatus, issueCompletionCode } from "../../services/completionCode";
import { CompletionCodeSheet } from "./CompletionCodeSheet";

// The real sheet is a Modal driven by reanimated: what matters here is its content.
jest.mock("../ui/BottomSheet", () => {
  const { Text, View } = jest.requireActual("react-native");
  return {
    BottomSheet: ({ visible, title, children, footer }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
        </View>
      ) : null,
  };
});
jest.mock("../ui/QrCode", () => {
  const { Text } = jest.requireActual("react-native");
  return { QrCode: ({ value }: { value: string }) => <Text>{"QR " + value}</Text> };
});
jest.mock("../../features/pro/presence", () => ({
  ...jest.requireActual("../../features/pro/presence"),
  presenceLink: (code: string) => "https://worldhair.test/rdv/" + code,
}));
jest.mock("../../services/completionCode", () => ({
  ...jest.requireActual("../../services/completionCode"),
  issueCompletionCode: jest.fn(),
  getPresenceStatus: jest.fn(),
}));
jest.mock("../../lib/apiClient", () => ({ apiClient: {} }));
jest.mock("../../lib/supabase", () => ({ supabase: {} }));
jest.mock("../../lib/uploadPhoto", () => ({}));

const issue = issueCompletionCode as jest.Mock;
const status = getPresenceStatus as jest.Mock;

const APPOINTMENT = { id: "a1", clientName: "Camille D." };
const MIN = 60_000;

function codeValidFor(minutes: number, code = "ABCDEFGHJKMN") {
  return { code, expiresAt: new Date(Date.now() + minutes * MIN).toISOString() };
}

function refused(statusCode: number, message: string): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status: statusCode,
    statusText: "",
    headers,
    config: { headers },
    data: { message },
  });
}

/** Lets pending promises settle, then moves the clock. */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe("CompletionCodeSheet", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    issue.mockReset();
    status.mockReset();
    status.mockResolvedValue({ confirmedByClientAt: null });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("asks for a code when it opens and shows its QR code with how to use it", async () => {
    issue.mockResolvedValueOnce(codeValidFor(5));
    await render(<CompletionCodeSheet appointment={APPOINTMENT} visible onClose={jest.fn()} />);
    await advance(0);

    expect(issue).toHaveBeenCalledWith("a1");
    expect(screen.getByText("QR https://worldhair.test/rdv/ABCDEFGHJKMN")).toBeTruthy();
    expect(
      screen.getByText("Faites scanner ce code par votre client avec l'appareil photo de son téléphone."),
    ).toBeTruthy();
    expect(screen.getByText("Valable encore 5 min")).toBeTruthy();
  });

  it("asks for nothing while it is closed", async () => {
    await render(<CompletionCodeSheet appointment={APPOINTMENT} visible={false} onClose={jest.fn()} />);
    await advance(10 * MIN);
    expect(issue).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("replaces the code a minute before it expires, and keeps showing a valid one", async () => {
    issue.mockResolvedValueOnce(codeValidFor(5, "AAAAAAAAAAAA")).mockResolvedValueOnce(codeValidFor(5, "BBBBBBBBBBBB"));
    await render(<CompletionCodeSheet appointment={APPOINTMENT} visible onClose={jest.fn()} />);
    await advance(0);

    await advance(3 * MIN + 50_000);
    expect(issue).toHaveBeenCalledTimes(1);
    expect(screen.getByText("QR https://worldhair.test/rdv/AAAAAAAAAAAA")).toBeTruthy();

    await advance(15_000);
    expect(issue).toHaveBeenCalledTimes(2);
    expect(screen.getByText("QR https://worldhair.test/rdv/BBBBBBBBBBBB")).toBeTruthy();
  });

  it("keeps the code on screen when a renewal fails while it still works, and tries again", async () => {
    issue
      .mockResolvedValueOnce(codeValidFor(5, "AAAAAAAAAAAA"))
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce(codeValidFor(5, "CCCCCCCCCCCC"));
    await render(<CompletionCodeSheet appointment={APPOINTMENT} visible onClose={jest.fn()} />);
    await advance(0);

    await advance(4 * MIN);
    expect(issue).toHaveBeenCalledTimes(2);
    expect(screen.getByText("QR https://worldhair.test/rdv/AAAAAAAAAAAA")).toBeTruthy();
    expect(screen.queryByText("Réessayer")).toBeNull();

    await advance(6_000);
    expect(issue).toHaveBeenCalledTimes(3);
    expect(screen.getByText("QR https://worldhair.test/rdv/CCCCCCCCCCCC")).toBeTruthy();
  });

  it("checks every few seconds whether the client scanned, then says so and tells the caller", async () => {
    issue.mockResolvedValue(codeValidFor(5));
    const onConfirmed = jest.fn();
    await render(
      <CompletionCodeSheet appointment={APPOINTMENT} visible onClose={jest.fn()} onConfirmed={onConfirmed} />,
    );
    await advance(0);

    await advance(4_000);
    expect(status).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledWith("a1");
    expect(onConfirmed).not.toHaveBeenCalled();

    status.mockResolvedValue({ confirmedByClientAt: new Date().toISOString() });
    await advance(4_000);

    expect(screen.getByText("Confirmé par Camille D.")).toBeTruthy();
    expect(screen.getByText("Fermer")).toBeTruthy();
    expect(onConfirmed).toHaveBeenCalledTimes(1);

    // Done: nothing more is asked, not even a new code.
    const issued = issue.mock.calls.length;
    const checked = status.mock.calls.length;
    await advance(10 * MIN);
    expect(issue).toHaveBeenCalledTimes(issued);
    expect(status).toHaveBeenCalledTimes(checked);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("says why there's no code in French, and offers to try again", async () => {
    issue.mockRejectedValueOnce(refused(400, "This appointment hasn't started yet"));
    issue.mockResolvedValueOnce(codeValidFor(5));
    await render(<CompletionCodeSheet appointment={APPOINTMENT} visible onClose={jest.fn()} />);
    await advance(0);

    expect(screen.getByText("Le rendez-vous n'a pas encore commencé.")).toBeTruthy();

    await fireEvent.press(screen.getByText("Réessayer"));
    await advance(0);
    expect(issue).toHaveBeenCalledTimes(2);
    expect(screen.getByText("QR https://worldhair.test/rdv/ABCDEFGHJKMN")).toBeTruthy();
    expect(screen.queryByText("Le rendez-vous n'a pas encore commencé.")).toBeNull();
  });

  it("asks for nothing once the error is on screen", async () => {
    issue.mockRejectedValueOnce(refused(400, "This appointment is marked absent"));
    await render(<CompletionCodeSheet appointment={APPOINTMENT} visible onClose={jest.fn()} />);
    await advance(0);

    await advance(60_000);
    expect(issue).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it("stops every timer when it closes or unmounts, and ignores an answer that arrives late", async () => {
    let answerLate: (value: ReturnType<typeof codeValidFor>) => void = () => {};
    issue.mockReturnValueOnce(new Promise((resolve) => (answerLate = resolve)));
    const { unmount } = await render(
      <CompletionCodeSheet appointment={APPOINTMENT} visible onClose={jest.fn()} onConfirmed={jest.fn()} />,
    );
    await advance(0);
    await unmount();

    await act(async () => {
      answerLate(codeValidFor(5));
    });
    await advance(10 * MIN);
    expect(issue).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it("starts over with a new code each time it opens", async () => {
    issue.mockResolvedValueOnce(codeValidFor(5, "AAAAAAAAAAAA")).mockResolvedValueOnce(codeValidFor(5, "BBBBBBBBBBBB"));
    const { rerender } = await render(<CompletionCodeSheet appointment={APPOINTMENT} visible onClose={jest.fn()} />);
    await advance(0);

    await rerender(<CompletionCodeSheet appointment={APPOINTMENT} visible={false} onClose={jest.fn()} />);
    await advance(10 * MIN);
    expect(issue).toHaveBeenCalledTimes(1);

    await rerender(<CompletionCodeSheet appointment={APPOINTMENT} visible onClose={jest.fn()} />);
    await advance(0);
    expect(issue).toHaveBeenCalledTimes(2);
    expect(screen.getByText("QR https://worldhair.test/rdv/BBBBBBBBBBBB")).toBeTruthy();
  });
});
