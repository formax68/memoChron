declare module "ical.js" {
  export class Component {
    constructor(jCal: any);
    getAllSubcomponents(name: string): Component[];
    getFirstProperty(name: string): Property;
    hasProperty(name: string): boolean;
  }

  export class Property {
    getFirstValue(): any;
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
  }

  export class Time {
    toJSDate(): Date;
    clone(): Time;
    addDuration(duration: Duration): void;
    toUnixTime(): number;
  }

  export class Duration {
    toSeconds(): number;
  }

  export class RecurExpansion {
    next(): Time | null;
  }

  export function parse(input: string): any;
}
