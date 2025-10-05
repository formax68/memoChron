declare module "ical.js" {
  export class Component {
    constructor(jCal: any);
    getAllSubcomponents(name: string): Component[];
    getFirstProperty(name: string): Property;
    getAllProperties(name: string): Property[];
    hasProperty(name: string): boolean;
    getFirstPropertyValue(name: string): any;
  }

  export class Property {
    getFirstValue(): any;
    getParameter(name: string): string;
    getValues(): any[];
  }

  export class Event {
    constructor(component: Component);
    readonly uid: string;
    readonly summary: string;
    readonly description: string;
    readonly location: string;
    readonly startDate: Time;
    readonly endDate: Time;
    readonly duration: Duration;
    iterator(): RecurExpansion;
    component: Component;
  }

  export class Time {
    constructor();
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    isDate: boolean;
    timezone: string;
    toJSDate(): Date;
    fromJSDate(date: Date): void;
    clone(): Time;
    addDuration(duration: Duration): void;
    toUnixTime(): number;
    zone: Timezone | null;
    convertToZone(timezone: Timezone): Time;
  }

  export class Duration {
    toSeconds(): number;
  }

  export class RecurExpansion {
    next(): Time | null;
  }

  export class Timezone {
    static fromData(data: any): Timezone;
    static utcTimezone: Timezone;
    static localTimezone: Timezone;
    tzid: string;
  }

  export class TimezoneService {
    static register(timezone: Component | Timezone): void;
    static has(tzid: string): boolean;
    static get(tzid: string): Timezone | null;
    static reset(): void;
  }

  export function parse(input: string): any;
}
