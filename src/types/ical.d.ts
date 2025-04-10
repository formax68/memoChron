declare module "ical.js" {
  export class Component {
    constructor(jCal: any);
    getAllSubcomponents(name: string): Component[];
  }

  export class Event {
    constructor(component: Component);
    readonly uid: string;
    readonly summary: string;
    readonly description: string;
    readonly location: string;
    readonly startDate: Time;
    readonly endDate: Time;
  }

  export class Time {
    toJSDate(): Date;
  }

  export function parse(input: string): any;
}
