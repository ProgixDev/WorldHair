import { supabase } from "./supabase";
import { uploadUserPhoto } from "./uploadPhoto";

jest.mock("./supabase", () => {
  const bucket = {
    upload: jest.fn(),
    getPublicUrl: jest.fn(),
  };
  return { supabase: { storage: { from: jest.fn(() => bucket) } } };
});

const bucket = supabase.storage.from("user-photos") as unknown as {
  upload: jest.Mock;
  getPublicUrl: jest.Mock;
};

describe("uploadUserPhoto", () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff]).buffer;

  beforeEach(() => {
    bucket.upload.mockReset().mockResolvedValue({ data: {}, error: null });
    bucket.getPublicUrl
      .mockReset()
      .mockReturnValue({ data: { publicUrl: "https://cdn.example/u1/avatar.jpg" } });
    global.fetch = jest.fn().mockResolvedValue({
      arrayBuffer: async () => bytes,
      blob: async () => ({ type: "image/jpeg", size: 3 }),
    }) as unknown as typeof fetch;
  });

  // Supabase's docs: in React Native, Blob/File/FormData uploads "do not
  // work as intended" — the body has to be an ArrayBuffer.
  it("uploads the file bytes as an ArrayBuffer, not a Blob", async () => {
    await uploadUserPhoto("u1", "avatar", "file:///cache/pick.jpg");

    const [path, body, options] = bucket.upload.mock.calls[0];
    expect(path).toBe("u1/avatar.jpg");
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect(options).toMatchObject({ upsert: true, contentType: "image/jpeg" });
  });

  it("derives a png content type from the extension when no mime type is given", async () => {
    await uploadUserPhoto("u1", "salon-cover", "file:///cache/pick.png");

    expect(bucket.upload.mock.calls[0][2]).toMatchObject({ contentType: "image/png" });
  });

  it("returns the public URL", async () => {
    await expect(uploadUserPhoto("u1", "avatar", "file:///cache/pick.jpg")).resolves.toBe(
      "https://cdn.example/u1/avatar.jpg",
    );
  });
});
