import { ApplicationStatus, CoiffeurApplication } from '../coiffeur-applications.service';
import { PracticeZone } from './submit-application.dto';

/** What both the coiffeur's own screens and the admin review queue see. */
export class CoiffeurApplicationDto {
  id!: string;
  profileId!: string;
  firstName!: string;
  lastName!: string;
  phone!: string;
  salonName!: string;
  description!: string;
  practiceZone!: PracticeZone;
  addressLine!: string | null;
  postalCode!: string | null;
  city!: string | null;
  invoiceDocumentPath!: string | null;
  travelRadiusKm!: number | null;
  identityDocumentPath!: string;
  diplomaDocumentPath!: string;
  kbisDocumentPath!: string;
  status!: ApplicationStatus;
  reviewMessage!: string | null;
  shopProfileComplete!: boolean;
  submittedAt!: string;
  reviewedAt!: string | null;
}

export function toCoiffeurApplicationDto(application: CoiffeurApplication): CoiffeurApplicationDto {
  return { ...application };
}
