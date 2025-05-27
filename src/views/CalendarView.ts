import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { CalendarEvent } from "../services/CalendarService";
import MemoChron from "../main";
import { MEMOCHRON_VIEW_TYPE } from "../utils/constants";

export class CalendarView extends ItemView {
  private plugin: MemoChron;
  private calendar: HTMLElement;
  private agenda: HTMLElement;
  private currentDate: Date;
  private selectedDate: Date | null = null;
  private currentMonthDays: Map<string, HTMLElement> = new Map();
  
  // Infinite scroll properties
  private eventsLoaded: number = 0;
  private readonly eventsPerPage: number = 50;
  private isLoadingMoreEvents: boolean = false;
  private allEventsLoaded: boolean = false;
  private scrollListenerAdded: boolean = false;
  
  // Date synchronization properties
  private visibleDateFromScroll: Date | null = null;
  private isScrollingToDate: boolean = false;
  private dateScrollMap: Map<string, HTMLElement> = new Map();
  private scrollTimeout: number | null = null;

  // Register for view visibility changes
  private registerViewEvents() {
    // Check if view is already registered for events
    if ((this as any).isViewEventsRegistered) {
      return;
    }

    // Watch for workspace layout changes to detect when view becomes visible
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        // If this view is now visible and wasn't before, refresh events
        const isVisible = this.leaf.view === this;
        if (isVisible) {
          this.refreshEvents();
        }
      })
    );

    (this as any).isViewEventsRegistered = true;
  }

  constructor(leaf: WorkspaceLeaf, plugin: MemoChron) {
    super(leaf);
    this.plugin = plugin;
    this.currentDate = new Date();
  }

  getViewType(): string {
    return MEMOCHRON_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "MemoChron calendar";
  }

  getIcon(): string {
    return "calendar-range";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();

    // Create navigation controls
    const controls = container.createEl("div", { cls: "memochron-controls" });
    const nav = controls.createEl("div", { cls: "memochron-nav" });

    // Title on the left
    const title = nav.createEl("span", { cls: "memochron-title" });

    // Navigation buttons grouped on the right
    const navButtons = nav.createEl("div", { cls: "memochron-nav-buttons" });
    // Replace buttons with clickable text
    const prevText = navButtons.createEl("span", {
      text: "<",
      cls: "memochron-nav-link",
    });
    const todayText = navButtons.createEl("span", {
      text: "Today",
      cls: "memochron-nav-link",
    });
    const nextText = navButtons.createEl("span", {
      text: ">",
      cls: "memochron-nav-link",
    });

    prevText.onclick = () => this.navigate(-1);
    todayText.onclick = () => this.goToday();
    nextText.onclick = () => this.navigate(1);

    // Create main layout container with separate calendar and agenda sections
    const mainLayout = container.createEl("div", { cls: "memochron-main-layout" });
    
    // Create calendar container
    const calendarSection = mainLayout.createEl("div", { cls: "memochron-calendar-section" });
    this.calendar = calendarSection.createEl("div", { cls: "memochron-calendar" });
    
    // Create agenda container with its own scrollable area
    const agendaSection = mainLayout.createEl("div", { cls: "memochron-agenda-section" });
    this.agenda = agendaSection.createEl("div", { cls: "memochron-agenda" });

    // Register for layout change events to detect when view becomes visible again
    this.registerViewEvents();

    // Force refresh events when view is opened/reopened
    await this.refreshEvents();

    // Automatically select today's date and show events
    await this.goToday();
  }

  private async navigate(delta: number) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    await this.refreshEvents();
  }

  private async goToday() {
    const newDate = new Date();
    // Only update if we're not already on today's date
    if (
      this.currentDate.getMonth() !== newDate.getMonth() ||
      this.currentDate.getFullYear() !== newDate.getFullYear()
    ) {
      this.currentDate = newDate;
      await this.refreshEvents();
    }
    this.selectDate(newDate);
  }

  private async selectDate(date: Date) {
    if (this.selectedDate) {
      const prevKey = this.selectedDate.toDateString();
      const prevEl = this.currentMonthDays.get(prevKey);
      if (prevEl) {
        prevEl.removeClass("selected");
      }
    }

    this.selectedDate = date;
    const newKey = date.toDateString();
    const newEl = this.currentMonthDays.get(newKey);
    if (newEl) {
      newEl.addClass("selected");
    }

    // Always show upcoming events instead of just day events
    await this.showUpcomingEventsAgenda();
    
    // Wait for DOM to be fully rendered and then scroll to the selected date
    // Use a more robust timing mechanism
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          this.scrollToDateInList(date);
        }, 100);
      });
    });
  }

  async refreshEvents(forceRefresh = false) {
    // Fetch from sources with option to force refresh
    await this.plugin.calendarService.fetchCalendars(
      this.plugin.settings.calendarUrls,
      forceRefresh
    );
    this.renderMonth();
    // Always show upcoming events
    await this.showUpcomingEventsAgenda();
  }

  private renderMonth() {
    this.calendar.empty();
    this.currentMonthDays.clear();

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // Update title
    const titleEl = this.containerEl.querySelector(".memochron-title");
    if (titleEl) {
      titleEl.textContent = new Date(year, month).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
    }

    // Create calendar grid
    const grid = this.calendar.createEl("div", {
      cls: "memochron-calendar-grid",
    });

    // Add weekday headers with respect to first day of week
    const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
    const firstDay = this.plugin.settings.firstDayOfWeek;
    const reorderedWeekdays = [
      ...weekdays.slice(firstDay),
      ...weekdays.slice(0, firstDay),
    ];

    reorderedWeekdays.forEach((day) => {
      grid.createEl("div", {
        cls: "memochron-weekday",
        text: day,
      });
    });

    // Get first day of month and number of days
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Calculate the day of week adjusted for first day of week setting
    let adjustedFirstDay = firstDayOfMonth.getDay() - firstDay;
    if (adjustedFirstDay < 0) adjustedFirstDay += 7;

    // Add empty cells for days before start of month
    for (let i = 0; i < adjustedFirstDay; i++) {
      grid.createEl("div", { cls: "memochron-day empty" });
    }

    const today = new Date();
    const todayString = today.toDateString();

    // Add cells for each day
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toDateString();

      const dayEl = grid.createEl("div", {
        cls: "memochron-day",
      });

      // Store reference to the day element
      this.currentMonthDays.set(dateString, dayEl);

      // Add selected class if this is the selected date
      if (
        this.selectedDate &&
        dateString === this.selectedDate.toDateString()
      ) {
        dayEl.addClass("selected");
      }

      // Add today class if this is today
      if (dateString === todayString) {
        dayEl.addClass("today");
      }

      const dayHeader = dayEl.createEl("div", {
        cls: "memochron-day-header",
        text: String(day),
      });

      // Get events for this day
      const events = this.plugin.calendarService.getEventsForDate(date);

      if (events.length > 0) {
        dayEl.addClass("has-events");
        const dot = dayEl.createEl("div", {
          cls: "memochron-event-dot",
          text: "•",
        });
      }

      // Improve touch handling
      dayEl.addEventListener(
        "touchstart",
        (e) => {
          // Prevent double-tap zoom
        },
        { passive: false }
      );

      dayEl.addEventListener("click", (e) => {
        this.selectDate(date);
      });
    }
  }

  private async showUpcomingEventsAgenda(append: boolean = false) {
    if (!append) {
      this.agenda.empty();
      this.eventsLoaded = 0;
      this.allEventsLoaded = false;
      this.dateScrollMap.clear(); // Clear date scroll map when resetting agenda
      
      // Create header
      const header = this.agenda.createEl("h3", {
        text: "Events Timeline",
      });
    }

    if (this.isLoadingMoreEvents || this.allEventsLoaded) {
      return;
    }

    this.isLoadingMoreEvents = true;

    // Show loading indicator when appending more events
    let loadingEl: HTMLElement | null = null;
    if (append) {
      loadingEl = this.agenda.createEl("div", { cls: "memochron-loading" });
      const spinner = loadingEl.createEl("div", { cls: "memochron-loading-spinner" });
      loadingEl.createEl("span", { text: "Loading more events..." });
    }

    // Get all events around today's date (30 days before, 90 days after)
    // This provides a comprehensive timeline including past events
    const today = new Date();
    const allEvents = this.plugin.calendarService.getAllEventsAroundDate(today, 30, 90);
    const startIndex = this.eventsLoaded;
    const endIndex = Math.min(startIndex + this.eventsPerPage, allEvents.length);
    const eventsToShow = allEvents.slice(startIndex, endIndex);

    // Remove loading indicator
    if (loadingEl) {
      loadingEl.remove();
    }

    if (eventsToShow.length === 0) {
      this.allEventsLoaded = true;
      this.isLoadingMoreEvents = false;
      
      if (this.eventsLoaded === 0) {
        this.agenda.createEl("p", { text: "No events found" });
      }
      return;
    }

    let list = this.agenda.querySelector(".memochron-agenda-list") as HTMLElement;
    if (!list) {
      list = this.agenda.createEl("div", { cls: "memochron-agenda-list" });
      
      // Add scroll listener for infinite scroll only once
      if (!this.scrollListenerAdded) {
        this.agenda.addEventListener("scroll", this.handleScroll.bind(this));
        this.scrollListenerAdded = true;
      }
    }

    const now = new Date();
    let currentDay = "";
    
    // Get the last day shown to avoid duplicate day separators
    if (append && this.eventsLoaded > 0) {
      const lastEvent = allEvents[this.eventsLoaded - 1];
      if (lastEvent) {
        currentDay = lastEvent.start.toDateString();
      }
    }

    eventsToShow.forEach((event) => {
      const eventDateStr = event.start.toDateString();
      
      // Add day separator if this is a new day
      if (eventDateStr !== currentDay) {
        currentDay = eventDateStr;
        
        // Add day header
        const dayHeader = list.createEl("div", { 
          cls: "memochron-day-separator",
          text: event.start.toLocaleDateString("default", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: event.start.getFullYear() !== now.getFullYear() ? "numeric" : undefined
          })
        });
        
        // Add visual indicator for past/future dates
        const eventDate = new Date(event.start);
        eventDate.setHours(0, 0, 0, 0);
        const todayDate = new Date(now);
        todayDate.setHours(0, 0, 0, 0);
        
        if (eventDate.getTime() < todayDate.getTime()) {
          dayHeader.addClass("past-date");
        } else if (eventDate.getTime() === todayDate.getTime()) {
          dayHeader.addClass("today-date");
        } else {
          dayHeader.addClass("future-date");
        }
        
        // Store reference to day header for scrolling
        this.dateScrollMap.set(eventDateStr, dayHeader);
        console.log(`Added date to scroll map: ${eventDateStr}. Total dates: ${this.dateScrollMap.size}`);
      }

      const eventEl = list.createEl("div", { cls: "memochron-agenda-event" });

      // Add past-event class if the event has ended
      if (event.end < now) {
        eventEl.addClass("past-event");
      }

      // Add today class if the event is today
      if (event.start.toDateString() === now.toDateString()) {
        eventEl.addClass("today-event");
      }

      eventEl.createEl("div", {
        cls: "memochron-event-time",
        text: `${event.start.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })} - ${event.end.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      });

      eventEl.createEl("div", {
        cls: "memochron-event-title",
        text: event.title,
      });

      if (event.location) {
        // Check if the location field likely contains a URL
        const isUrl =
          event.location.startsWith("http://") ||
          event.location.startsWith("https://") ||
          event.location.startsWith("www.");

        // Check if it's likely a virtual meeting link
        const isVirtual =
          event.location.toLowerCase().includes("zoom") ||
          event.location.toLowerCase().includes("meet.") ||
          event.location.toLowerCase().includes("teams") ||
          event.location.toLowerCase().includes("webex");

        const icon = isUrl ? "🔗" : isVirtual ? "💻" : "📍";

        eventEl.createEl("div", {
          cls: "memochron-event-location",
          text: `${icon} ${event.location}`,
        });
      }

      // Improve touch handling for event items
      eventEl.addEventListener(
        "touchstart",
        (e) => {
          // Prevent double-tap zoom
        },
        { passive: false }
      );

      eventEl.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await this.showEventDetails(event);
        } catch (error) {
          console.error("Failed to create note:", error);
          new Notice("Failed to create note. Check the console for details.");
        }
      });
    });

    this.eventsLoaded = endIndex;
    
    // Check if we've loaded all events
    if (endIndex >= allEvents.length) {
      this.allEventsLoaded = true;
    }

    this.isLoadingMoreEvents = false;
    console.log(`showEventsAgenda completed. Total events loaded: ${this.eventsLoaded}, Date scroll map size: ${this.dateScrollMap.size}`);
  }

  private handleScroll() {
    // Skip if we're programmatically scrolling to a date
    if (this.isScrollingToDate) {
      return;
    }

    // Infinite scroll logic
    if (!this.isLoadingMoreEvents && !this.allEventsLoaded) {
      const { scrollTop, scrollHeight, clientHeight } = this.agenda;
      
      // Load more when user scrolls to within 200px of the bottom
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        this.showUpcomingEventsAgenda(true);
      }
    }

    // Throttle date synchronization for better performance
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(() => {
      this.updateCalendarFromScroll();
    }, 100) as unknown as number;
  }

  async onClose() {
    // Clean up any pending timeouts
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
    
    // Note: We can't easily remove the specific scroll listener since we bound it inline
    // This is acceptable since the view is being destroyed anyway
    this.scrollListenerAdded = false;
  }

  private async showEventDetails(event: CalendarEvent) {
    try {
      // First ensure we have a note location set
      if (!this.plugin.settings.noteLocation) {
        new Notice("Please set a note location in settings first");
        return;
      }

      const file = await this.plugin.noteService.createEventNote(event);
      if (!file) {
        throw new Error("Failed to create or update note");
      }

      const leaf = this.app.workspace.getLeaf("tab");
      if (leaf) {
        await leaf.openFile(file);
      } else {
        new Notice("Could not open the note in a new tab");
      }
    } catch (error) {
      console.error("Error showing event details:", error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  private scrollToDateInList(date: Date) {
    const dateStr = date.toDateString();
    const dayElement = this.dateScrollMap.get(dateStr);
    
    console.log(`Attempting to scroll to date: ${dateStr}`);
    console.log(`Available dates in map:`, Array.from(this.dateScrollMap.keys()));
    console.log(`Found element for date:`, !!dayElement);
    
    if (dayElement) {
      console.log('Scrolling to exact date match');
      this.isScrollingToDate = true;
      dayElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Reset the flag after a brief delay to allow for smooth scrolling
      setTimeout(() => {
        this.isScrollingToDate = false;
      }, 500);
      return;
    }

    // If the exact date isn't in the map, find the best date to scroll to
    const selectedTime = date.getTime();
    
    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    // Get selected date at midnight for comparison
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    const selectedDateTime = selectedDate.getTime();
    
    console.log(`Date not found in scroll map. Selected date: ${selectedDate.toDateString()}, Today: ${today.toDateString()}`);
    console.log(`Selected date time: ${selectedDateTime}, Today time: ${todayTime}`);
    
    // Get all available dates and sort them
    const availableDates = Array.from(this.dateScrollMap.keys())
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime());
      
    console.log('Available dates for closest match:', availableDates.map(d => d.toDateString()));

    if (availableDates.length === 0) {
      console.log('No dates available in scroll map');
      return;
    }
    
    let targetDate: Date | null = null;
    
    if (selectedDateTime < todayTime) {
      // For past dates, find the closest past date with events
      console.log('Looking for closest past date with events');
      
      // Find the latest date that is <= the selected date
      for (let i = availableDates.length - 1; i >= 0; i--) {
        const availableDate = availableDates[i];
        const availableDateMidnight = new Date(availableDate);
        availableDateMidnight.setHours(0, 0, 0, 0);
        
        if (availableDateMidnight.getTime() <= selectedDateTime) {
          targetDate = availableDate;
          break;
        }
      }
      
      // If no past date found, scroll to the earliest available date
      // This handles the case where we're showing "upcoming events" and clicked on a past date
      if (!targetDate) {
        targetDate = availableDates[0];
        console.log('No past date found in upcoming events, scrolling to earliest upcoming event');
      } else {
        console.log(`Found closest past date with events: ${targetDate.toDateString()}`);
      }
    } else {
      // For future dates or today, find the closest future date
      console.log('Looking for closest future date with events');
      
      // Look for the first date that is >= the selected date
      for (const availableDate of availableDates) {
        const availableDateMidnight = new Date(availableDate);
        availableDateMidnight.setHours(0, 0, 0, 0);
        
        if (availableDateMidnight.getTime() >= selectedDateTime) {
          targetDate = availableDate;
          break;
        }
      }
      
      // If no future date found, use the last (most recent) date
      if (!targetDate && availableDates.length > 0) {
        targetDate = availableDates[availableDates.length - 1];
        console.log('No future date found, using most recent date');
      }
    }
    
    if (targetDate) {
      console.log(`Found target date for scrolling: ${targetDate.toDateString()}`);
      const targetElement = this.dateScrollMap.get(targetDate.toDateString());
      if (targetElement) {
        this.isScrollingToDate = true;
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          this.isScrollingToDate = false;
        }, 500);
        return;
      }
    }
    
    // As a last resort, try to load more events to find the date
    console.log('No suitable date found, attempting to load more events');
    this.loadEventsUntilDate(date);
  }

  private updateCalendarFromScroll() {
    const agendaRect = this.agenda.getBoundingClientRect();
    const scrollTop = this.agenda.scrollTop;
    
    // Find the first visible day separator
    let visibleDate: Date | null = null;
    
    for (const [dateStr, element] of this.dateScrollMap.entries()) {
      const elementRect = element.getBoundingClientRect();
      const relativeTop = elementRect.top - agendaRect.top + scrollTop;
      
      // Check if this element is visible (within the agenda's viewport)
      if (relativeTop <= scrollTop + 100) { // 100px buffer for better UX
        visibleDate = new Date(dateStr);
      } else {
        break; // Elements are in chronological order, so we can break early
      }
    }

    if (visibleDate && (!this.visibleDateFromScroll || 
        visibleDate.toDateString() !== this.visibleDateFromScroll.toDateString())) {
      this.visibleDateFromScroll = visibleDate;
      this.highlightDateInCalendar(visibleDate);
    }
  }

  private highlightDateInCalendar(date: Date) {
    // Check if we need to navigate to a different month
    if (date.getMonth() !== this.currentDate.getMonth() || 
        date.getFullYear() !== this.currentDate.getFullYear()) {
      this.currentDate = new Date(date);
      this.renderMonth();
    }

    // Clear previous scroll-based highlighting
    this.currentMonthDays.forEach((dayEl, dateStr) => {
      dayEl.removeClass("scroll-highlighted");
    });

    // Add scroll-based highlighting to the visible date
    const dateStr = date.toDateString();
    const dayEl = this.currentMonthDays.get(dateStr);
    if (dayEl) {
      dayEl.addClass("scroll-highlighted");
    }
  }

  private async loadEventsUntilDate(targetDate: Date) {
    const targetTime = targetDate.getTime();
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loading
    
    while (attempts < maxAttempts && !this.allEventsLoaded) {
      const today = new Date();
      const allEvents = this.plugin.calendarService.getAllEventsAroundDate(today, 30, 90);
      
      // Check if we have events that go at least to the target date
      if (allEvents.length > 0) {
        const lastEventDate = allEvents[allEvents.length - 1].start.getTime();
        
        if (lastEventDate >= targetTime) {
          // We have events up to the target date, refresh the agenda to include them
          await this.showUpcomingEventsAgenda(true);
          
          // Try to find the date again
          const dateStr = targetDate.toDateString();
          const dayElement = this.dateScrollMap.get(dateStr);
          if (dayElement) {
            this.isScrollingToDate = true;
            dayElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => {
              this.isScrollingToDate = false;
            }, 500);
            return;
          }
        }
      }
      
      // Load more events
      await this.showUpcomingEventsAgenda(true);
      attempts++;
      
      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // If we couldn't find the date, just scroll to the bottom
    this.agenda.scrollTo({ 
      top: this.agenda.scrollHeight, 
      behavior: 'smooth' 
    });
  }
}
