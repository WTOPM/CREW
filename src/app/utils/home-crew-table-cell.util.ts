import type { CrewMember, HomeCrewTableColumnId } from '../models/crew.models';
import type { PassengerMember } from '../models/passenger.models';
import { PASSENGER_RANK } from '../models/passenger.models';

/** Plain text for one Table-view cell (display / clipboard only). */
export function homeCrewTableCellText(
  member: CrewMember,
  col: HomeCrewTableColumnId,
  formatDate: (iso: string) => string,
  rowIndex?: number,
): string {
  switch (col) {
    case 'index':
      return rowIndex != null ? String(rowIndex + 1) : '';
    case 'family':
      return member.familyName ?? '';
    case 'given':
      return member.givenNames ?? '';
    case 'rank':
      return member.rank ?? '';
    case 'nationality':
      return member.nationality ?? '';
    case 'gender':
      return member.gender ?? '';
    case 'dateOfBirth':
      return formatDate(member.dateOfBirth);
    case 'placeOfBirth':
      return member.placeOfBirth ?? '';
    case 'passport':
      return member.passport ?? '';
    case 'passportPlaceOfIssue':
      return member.passportPlaceOfIssue ?? '';
    case 'passportIssueDate':
      return formatDate(member.passportIssueDate);
    case 'passportExpiryDate':
      return formatDate(member.passportExpiryDate);
    case 'seamansBook':
      return member.seamansBook ?? '';
    case 'seamansBookPlaceOfIssue':
      return member.seamansBookPlaceOfIssue ?? '';
    case 'sbookIssueDate':
      return formatDate(member.sbookIssueDate);
    case 'sbookExpiryDate':
      return member.sbookExpiryDate === 'UNLIMITED'
        ? 'UNLIMITED'
        : formatDate(member.sbookExpiryDate);
    case 'cyprusSeamansBook':
      return member.cyprusSeamansBook ?? '';
    case 'cyprusIssueDate':
      return formatDate(member.cyprusIssueDate);
    case 'cyprusExpiryDate':
      return formatDate(member.cyprusExpiryDate);
    case 'visa':
      return member.visa ?? '';
    case 'visaIssueDate':
      return formatDate(member.visaIssueDate);
    case 'visaExpiryDate':
      return formatDate(member.visaExpiryDate);
    case 'joiningDate':
      return formatDate(member.joiningDate);
    case 'joiningPort':
      return member.joiningPort ?? '';
    case 'cabin':
      return member.cabin ?? '';
    case 'vaccineMedicalProduct':
      return member.vaccineMedicalProduct ?? '';
    case 'dateOfVaccination':
      return formatDate(member.dateOfVaccination);
    case 'dateOfYellowFeverVaccination':
      return formatDate(member.dateOfYellowFeverVaccination);
    case 'yellowFeverExpiry':
      return member.yellowFeverExpiryIsText
        ? (member.yellowFeverExpiryText ?? '')
        : formatDate(member.yellowFeverExpiryDate);
    default:
      return '';
  }
}

export function homePaxTableCellText(
  member: PassengerMember,
  col: HomeCrewTableColumnId,
  formatDate: (iso: string) => string,
  rowIndex?: number,
): string {
  switch (col) {
    case 'index':
      return rowIndex != null ? String(rowIndex + 1) : '';
    case 'family':
      return member.familyName ?? '';
    case 'given':
      return member.givenNames ?? '';
    case 'rank':
      return PASSENGER_RANK;
    case 'nationality':
      return member.nationality ?? '';
    case 'gender':
      return member.gender ?? '';
    case 'dateOfBirth':
      return formatDate(member.dateOfBirth);
    case 'placeOfBirth':
      return member.placeOfBirth ?? '';
    case 'passport':
      return member.passport ?? '';
    case 'passportIssueDate':
      return formatDate(member.passportIssueDate);
    case 'passportExpiryDate':
      return formatDate(member.passportExpiryDate);
    default:
      return '';
  }
}
