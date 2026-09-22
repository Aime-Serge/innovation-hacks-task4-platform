// MF-02: the discipline, seniority, employment-status and country lists come from the one
// configuration file the API and the migration also read, so the three never disagree.
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "../backend/config/profile_lists.json";
const OUT = "src/generated/profile-lists.ts";

type Option = { value: string; label: string };
type CountryOption = { code: string; name: string };
type ProfileLists = {
  disciplines: Option[];
  seniorities: Option[];
  employmentStatuses: Option[];
  unknownCountry: string;
  countries: CountryOption[];
};

const data = JSON.parse(readFileSync(SOURCE, "utf8")) as ProfileLists;

const banner =
  "// GENERATED FILE. Run `npm run generate:lists` to refresh from\n" +
  "// ../backend/config/profile_lists.json. Do not edit by hand (MF-02).\n\n";

const body = `export type ListOption = { value: string; label: string };
export type CountryOption = { code: string; name: string };

export const DISCIPLINES: ListOption[] = ${JSON.stringify(data.disciplines, null, 2)};

export const SENIORITIES: ListOption[] = ${JSON.stringify(data.seniorities, null, 2)};

export const EMPLOYMENT_STATUSES: ListOption[] = ${JSON.stringify(data.employmentStatuses, null, 2)};

export const UNKNOWN_COUNTRY = ${JSON.stringify(data.unknownCountry)};

export const COUNTRIES: CountryOption[] = ${JSON.stringify(data.countries, null, 2)};
`;

writeFileSync(OUT, banner + body);
console.log(`Wrote ${OUT} from ${SOURCE}.`);
