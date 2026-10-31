// Run with `npm test`, which pins TZ=Europe/Athens so the expected UTC
// instants differ from both the viewer's zone and the events' zones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Component, Event, parse } from "ical.js";
import {
  convertIcalTimeToDate,
  registerVTimezones,
} from "../src/utils/timezoneUtils";

const DENVER_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:America/Denver
BEGIN:DAYLIGHT
TZOFFSETFROM:-0700
TZOFFSETTO:-0600
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZNAME:MDT
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0600
TZOFFSETTO:-0700
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZNAME:MST
END:STANDARD
END:VTIMEZONE
`;

// Daily 09:00 event spanning the 2026-11-01 US DST change
function expand(tzid, vtimezone = "") {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
${vtimezone}BEGIN:VEVENT
UID:test
DTSTART;TZID=${tzid}:20261031T090000
DTEND;TZID=${tzid}:20261031T100000
RRULE:FREQ=DAILY;COUNT=3
END:VEVENT
END:VCALENDAR
`;
  const comp = new Component(parse(ics));
  registerVTimezones(comp);
  const iterator = new Event(comp.getFirstSubcomponent("vevent")).iterator();
  const starts = [];
  let next;
  while ((next = iterator.next())) {
    starts.push(convertIcalTimeToDate(next, tzid).toISOString());
  }
  return starts;
}

const DENVER_EXPECTED = [
  "2026-10-31T15:00:00.000Z",
  "2026-11-01T16:00:00.000Z",
  "2026-11-02T16:00:00.000Z",
];

test("IANA tzid with embedded VTIMEZONE uses its rules", () => {
  assert.deepEqual(expand("America/Denver", DENVER_VTIMEZONE), DENVER_EXPECTED);
});

test("IANA tzid without VTIMEZONE is not read as local time", () => {
  assert.deepEqual(expand("America/New_York"), [
    "2026-10-31T13:00:00.000Z",
    "2026-11-01T14:00:00.000Z",
    "2026-11-02T14:00:00.000Z",
  ]);
});

test("Windows tzid maps to IANA zone", () => {
  assert.deepEqual(expand("Mountain Standard Time"), DENVER_EXPECTED);
});

test("unknown tzid without VTIMEZONE falls back to local time", () => {
  assert.equal(expand("Not/AZone")[0], "2026-10-31T07:00:00.000Z");
});
