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

  // Window-based scrolling properties
  private currentWindowEvents: CalendarEvent[] = [];
  private todayIndex: number = 0; // Index of today's first event in the current window
  private windowStart: Date = new Date();
  private windowEnd: Date = new Date();
  private isLoadingMoreEvents: boolean = false;
  private scrollListenerAdded: boolean = false;

  // Simplified calendar sync properties
  private scrollSyncEnabled: boolean = true;
  private isScrollingToDate: boolean = false;
  private visibleDateElements: Map<string, HTMLElement> = new Map();
  private intersectionObserver: IntersectionObserver | null = null;
  private currentlyVisibleDates: Set<string> = new Set();
  private lastSelectedDate: string | null = null;

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
    const mainLayout = container.createEl("div", {
      cls: "memochron-main-layout",
    });

    // Create calendar container
    const calendarSection = mainLayout.createEl("div", {
      cls: "memochron-calendar-section",
    });
    this.calendar = calendarSection.createEl("div", {
      cls: "memochron-calendar",
    });

    // Create agenda container with its own scrollable area
    const agendaSection = mainLayout.createEl("div", {
      cls: "memochron-agenda-section",
    });
    this.agenda = agendaSection.createEl("div", { cls: "memochron-agenda" });

    // Register for layout change events to detect when view becomes visible again
    this.registerViewEvents();

    // Force refresh events when view is opened/reopened
    await this.refreshEvents();

    // Initialize scroll sync properties
    this.scrollSyncEnabled = true;
    this.isScrollingToDate = false;

    // Automatically select today's date and show events
    await this.goToday();
  }

  private async navigate(delta: number) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    await this.refreshEvents();

    // Preserve selected date if it's in the new month
    if (
      this.selectedDate &&
      this.selectedDate.getMonth() === this.currentDate.getMonth() &&
      this.selectedDate.getFullYear() === this.currentDate.getFullYear()
    ) {
      // Re-select the date in the new month view
      const dateKey = this.selectedDate.toDateString();
      const dayEl = this.currentMonthDays.get(dateKey);
      if (dayEl) {
        dayEl.addClass("selected");
      }
    }
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
    this.updateCalendarSelection(newDate, true);
  }

  private async selectDate(date: Date) {
    // Always show all events instead of just day events
    await this.showAllEventsAgenda();

    // Update selection and scroll to the selected date in the agenda
    this.updateCalendarSelection(date, true);
  }

  async refreshEvents(forceRefresh = false) {
    // Fetch from sources with option to force refresh
    await this.plugin.calendarService.fetchCalendars(
      this.plugin.settings.calendarUrls,
      forceRefresh
    );
    this.renderMonth();
    // Always show all events
    await this.showAllEventsAgenda();
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

  private async showAllEventsAgenda(append: boolean = false) {
    if (!append) {
      this.agenda.empty();
      this.currentWindowEvents = [];

      // Create header
      const header = this.agenda.createEl("h3", {
        text: "All Events",
      });

      // Load initial window of events around today
      await this.loadInitialWindow();
    }

    await this.renderEventsWindow();
  }

  async onClose() {
    // Clean up intersection observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }

    // Note: We can't easily remove the specific scroll listener since we bound it inline
    // This is acceptable since the view is being destroyed anyway
    this.scrollListenerAdded = false;
    this.scrollSyncEnabled = false;
    this.visibleDateElements.clear();
    this.currentMonthDays.clear();
    this.currentlyVisibleDates.clear();
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

  private async loadInitialWindow() {
    const today = new Date();
    this.currentWindowEvents = this.plugin.calendarService.getEventsWindow(
      today,
      30,
      60
    );

    // Find today's position in the window for initial scroll positioning
    this.todayIndex = this.findTodayIndexInWindow(today);

    // Set window boundaries
    this.windowStart = new Date(today);
    this.windowStart.setDate(this.windowStart.getDate() - 30);
    this.windowEnd = new Date(today);
    this.windowEnd.setDate(this.windowEnd.getDate() + 60);
  }

  private findTodayIndexInWindow(today: Date): number {
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);

    for (let i = 0; i < this.currentWindowEvents.length; i++) {
      if (this.currentWindowEvents[i].start >= startOfToday) {
        return i;
      }
    }

    return this.currentWindowEvents.length;
  }

  private async renderEventsWindow() {
    if (this.currentWindowEvents.length === 0) {
      this.agenda.createEl("p", { text: "No events" });
      return;
    }

    let list = this.agenda.querySelector(
      ".memochron-agenda-list"
    ) as HTMLElement;
    if (!list) {
      list = this.agenda.createEl("div", { cls: "memochron-agenda-list" });

      // Add unified scroll listener only once
      if (!this.scrollListenerAdded) {
        this.agenda.addEventListener("scroll", () => {
          this.handleBidirectionalScroll();
        });

        this.scrollListenerAdded = true;
      }
      
      // Set up intersection observer for date visibility tracking
      this.setupIntersectionObserver();
    } else {
      list.empty(); // Clear existing events for full re-render
    }

    // Clear the visible date elements map
    this.visibleDateElements.clear();

    const now = new Date();
    let currentDay = "";

    // Render all events in the current window
    this.currentWindowEvents.forEach((event, index) => {
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
            year:
              event.start.getFullYear() !== now.getFullYear()
                ? "numeric"
                : undefined,
          }),
        });

        // Add data attribute for date identification
        dayHeader.setAttribute("data-date", eventDateStr);

        // Store reference for scroll tracking
        this.visibleDateElements.set(eventDateStr, dayHeader);
        
        // Observe this date header for intersection
        if (this.intersectionObserver) {
          this.intersectionObserver.observe(dayHeader);
        }

        // Mark today's header for scroll positioning
        if (index === this.todayIndex) {
          dayHeader.id = "memochron-today-marker";
        }
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

    // Scroll to today's events after rendering (if not scrolling to a specific date)
    if (!this.isScrollingToDate) {
      setTimeout(() => {
        // Double-check isScrollingToDate flag in case it changed during setTimeout delay
        if (!this.isScrollingToDate) {
          const todayMarker = this.agenda.querySelector(
            "#memochron-today-marker"
          );
          if (todayMarker) {
            const targetPosition = (todayMarker as HTMLElement).offsetTop;
            const currentScroll = this.agenda.scrollTop;
            const scrollDiff = targetPosition - currentScroll;
            
            const agendaList = this.agenda.querySelector('.memochron-agenda-list') as HTMLElement;
            if (agendaList) {
              agendaList.style.transition = 'transform 0.3s ease-out';
              agendaList.style.transform = `translateY(${-scrollDiff}px)`;
            }
          }
        } else {
          console.log('SCROLL DEBUG: Skipping today marker scroll - isScrollingToDate is true');
        }
      }, 100);
    }
  }

  /**
   * Setup intersection observer to track date visibility
   */
  private setupIntersectionObserver(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    // Create intersection observer with appropriate threshold
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (!this.scrollSyncEnabled || this.isScrollingToDate) return;
        
        // Update visible dates set
        entries.forEach(entry => {
          const dateStr = entry.target.getAttribute('data-date');
          if (dateStr) {
            if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
              this.currentlyVisibleDates.add(dateStr);
            } else {
              this.currentlyVisibleDates.delete(dateStr);
            }
          }
        });
        
        // Update calendar selection based on visible dates
        this.updateCalendarFromVisibleDates();
      },
      {
        root: this.agenda,
        rootMargin: '-20% 0px -60% 0px', // Only consider top 40% of container
        threshold: [0, 0.3, 0.7, 1.0]
      }
    );

    // Observe all existing date headers
    this.visibleDateElements.forEach((element) => {
      this.intersectionObserver?.observe(element);
    });
  }

  private async handleBidirectionalScroll() {
    if (this.isLoadingMoreEvents) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = this.agenda;

    // Load more past events when scrolling near the bottom
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      await this.loadMorePastEvents();
    }

    // Load more future events when scrolling near the top
    if (scrollTop <= 200) {
      await this.loadMoreFutureEvents();
    }
  }

  private async loadMorePastEvents() {
    this.isLoadingMoreEvents = true;

    // Store current scroll position before adding events
    const currentScrollTop = this.agenda.scrollTop;

    // Extend window backwards by 30 days
    const newWindowStart = new Date(this.windowStart);
    newWindowStart.setDate(newWindowStart.getDate() - 30);

    const moreEvents = this.plugin.calendarService.getEventsInRange(
      newWindowStart,
      this.windowStart
    );

    if (moreEvents.length > 0) {
      // Store the first visible date before adding events
      const firstVisibleDate = this.getFirstVisibleDate();

      this.currentWindowEvents = [...moreEvents, ...this.currentWindowEvents];

      // Safely update today's index
      const today = new Date();
      this.todayIndex = this.findTodayIndexInWindow(today);

      this.windowStart = newWindowStart;

      await this.renderEventsWindow();

      // Restore scroll position to the previously visible date
      if (firstVisibleDate) {
        const targetElement = this.agenda.querySelector(
          `[data-date="${firstVisibleDate}"]`
        );
        if (targetElement) {
          console.log('SCROLL DEBUG: Restoring scroll position to:', firstVisibleDate);
          targetElement.scrollIntoView({ behavior: "auto", block: "start" });
        }
      }
    }

    this.isLoadingMoreEvents = false;
  }

  private async loadMoreFutureEvents() {
    this.isLoadingMoreEvents = true;

    // Extend window forwards by 30 days
    const newWindowEnd = new Date(this.windowEnd);
    newWindowEnd.setDate(newWindowEnd.getDate() + 30);

    const moreEvents = this.plugin.calendarService.getEventsInRange(
      this.windowEnd,
      newWindowEnd
    );

    if (moreEvents.length > 0) {
      this.currentWindowEvents = [...this.currentWindowEvents, ...moreEvents];
      this.windowEnd = newWindowEnd;

      await this.renderEventsWindow();
    }

    this.isLoadingMoreEvents = false;
  }

  /**
   * Scroll to a specific date in the agenda list
   */
  private async scrollToDateInAgenda(targetDate: Date): Promise<void> {
    if (!this.agenda) return;

    this.isScrollingToDate = true;
    const targetDateStr = targetDate.toDateString();

    // First check if the date is already visible in the current window
    const targetElement = this.agenda.querySelector(
      `[data-date="${targetDateStr}"]`
    );
    if (targetElement) {
      // Use CSS transform to position the target date at the top of the visible area
      const targetPosition = (targetElement as HTMLElement).offsetTop;
      const currentScroll = this.agenda.scrollTop;
      const scrollDiff = targetPosition - currentScroll;
      
      // Get the scrollable content container
      const agendaList = this.agenda.querySelector('.memochron-agenda-list') as HTMLElement;
      if (agendaList) {
        // Apply smooth transform to move content to desired position
        agendaList.style.transition = 'transform 0.3s ease-out';
        agendaList.style.transform = `translateY(${-scrollDiff}px)`;
        
        // Update the intersection observer's understanding of scroll position
        // by temporarily adjusting the root margin to account for the transform
        this.updateIntersectionObserverForTransform(scrollDiff);
      }
      
      setTimeout(() => {
        this.isScrollingToDate = false;
      }, 500);
      return;
    }

    // If date is not in current window, we need to load events around that date
    await this.loadEventsAroundDate(targetDate);

    // Try again after loading
    setTimeout(() => {
      const targetElement = this.agenda.querySelector(
        `[data-date="${targetDateStr}"]`
      );
      if (targetElement) {
        // Use CSS transform to position the target date
        const targetPosition = (targetElement as HTMLElement).offsetTop;
        const currentScroll = this.agenda.scrollTop;
        const scrollDiff = targetPosition - currentScroll;
        
        const agendaList = this.agenda.querySelector('.memochron-agenda-list') as HTMLElement;
        if (agendaList) {
          agendaList.style.transition = 'transform 0.3s ease-out';
          agendaList.style.transform = `translateY(${-scrollDiff}px)`;
          this.updateIntersectionObserverForTransform(scrollDiff);
        }
      } else {
        // If still no element found, scroll to the closest date
        this.scrollToClosestDate(targetDate);
      }
      this.isScrollingToDate = false;
    }, 100);
  }

  /**
   * Scroll to the closest available date when exact date is not found
   */
  private scrollToClosestDate(targetDate: Date): void {
    const targetTime = targetDate.getTime();
    let closestElement: HTMLElement | null = null;
    let closestDiff = Infinity;

    for (const [dateStr, element] of this.visibleDateElements) {
      const elementDate = new Date(dateStr);
      const diff = Math.abs(elementDate.getTime() - targetTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestElement = element;
      }
    }

    if (closestElement) {
      const targetPosition = closestElement.offsetTop;
      const currentScroll = this.agenda.scrollTop;
      const scrollDiff = targetPosition - currentScroll;
      
      const agendaList = this.agenda.querySelector('.memochron-agenda-list') as HTMLElement;
      if (agendaList) {
        agendaList.style.transition = 'transform 0.3s ease-out';
        agendaList.style.transform = `translateY(${-scrollDiff}px)`;
        this.updateIntersectionObserverForTransform(scrollDiff);
      }
    }
  }

  /**
   * Load events around a specific date and update the window
   */
  private async loadEventsAroundDate(centerDate: Date): Promise<void> {
    // Always try to extend the current window first to preserve scroll position
    const centerTime = centerDate.getTime();
    const windowStartTime = this.windowStart.getTime();
    const windowEndTime = this.windowEnd.getTime();

    // Extend window to include the target date if it's outside current range
    if (centerTime < windowStartTime || centerTime > windowEndTime) {
      await this.extendWindowToIncludeDate(centerDate);
    }

    // If the date is still not in the window after extension, create a new window
    // This only happens for dates very far from the current window
    if (
      centerTime < this.windowStart.getTime() ||
      centerTime > this.windowEnd.getTime()
    ) {
      // Store current scroll position to restore after re-render
      const currentScrollTop = this.agenda.scrollTop;

      this.currentWindowEvents = this.plugin.calendarService.getEventsWindow(
        centerDate,
        60, // Larger window to reduce future reloads
        90
      );

      // Update window boundaries
      this.windowStart = new Date(centerDate);
      this.windowStart.setDate(this.windowStart.getDate() - 60);
      this.windowEnd = new Date(centerDate);
      this.windowEnd.setDate(this.windowEnd.getDate() + 90);

      // Update today index for the new window
      const today = new Date();
      this.todayIndex = this.findTodayIndexInWindow(today);

      // Re-render the events window
      await this.renderEventsWindow();
    }
  }

  /**
   * Extend the current window to include a specific date
   */
  private async extendWindowToIncludeDate(targetDate: Date): Promise<void> {
    let needsRerender = false;

    // Extend backwards if needed
    if (targetDate < this.windowStart) {
      const newStart = new Date(targetDate);
      newStart.setDate(newStart.getDate() - 15); // Add some buffer

      const moreEvents = this.plugin.calendarService.getEventsInRange(
        newStart,
        this.windowStart
      );

      if (moreEvents.length > 0) {
        this.currentWindowEvents = [...moreEvents, ...this.currentWindowEvents];
        this.todayIndex += moreEvents.length; // Adjust today's index
        this.windowStart = newStart;
        needsRerender = true;
      }
    }

    // Extend forwards if needed
    if (targetDate > this.windowEnd) {
      const newEnd = new Date(targetDate);
      newEnd.setDate(newEnd.getDate() + 15); // Add some buffer

      const moreEvents = this.plugin.calendarService.getEventsInRange(
        this.windowEnd,
        newEnd
      );

      if (moreEvents.length > 0) {
        this.currentWindowEvents = [...this.currentWindowEvents, ...moreEvents];
        this.windowEnd = newEnd;
        needsRerender = true;
      }
    }

    if (needsRerender) {
      await this.renderEventsWindow();
    }
  }

  /**
   * Update calendar selection based on visible dates from intersection observer
   */
  private updateCalendarFromVisibleDates(): void {
    if (!this.scrollSyncEnabled || this.isScrollingToDate || this.isLoadingMoreEvents) {
      return;
    }

    // Convert visible dates to Date objects and sort them
    const visibleDates = Array.from(this.currentlyVisibleDates)
      .map(dateStr => ({ dateStr, date: new Date(dateStr) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (visibleDates.length === 0) return;

    // Find the "primary" visible date - prefer the first chronologically visible date
    // that represents a significant day boundary crossing
    let targetDate: Date | null = null;
    
    // If we have a previously selected date, check if we've crossed a significant boundary
    if (this.lastSelectedDate) {
      const lastDate = new Date(this.lastSelectedDate);
      const firstVisible = visibleDates[0].date;
      
      // Only change selection if we've moved to a significantly different date
      // (more than 12 hours difference) to avoid flickering within the same day
      const timeDiff = Math.abs(firstVisible.getTime() - lastDate.getTime());
      const dayInMs = 24 * 60 * 60 * 1000;
      
      if (timeDiff > dayInMs / 2) { // 12 hours threshold
        targetDate = firstVisible;
      }
    } else {
      // No previous selection, just use the first visible date
      targetDate = visibleDates[0].date;
    }

    // Update calendar selection if we have a target date and it's different from current
    if (targetDate && (!this.selectedDate || 
        targetDate.toDateString() !== this.selectedDate.toDateString())) {
      
      this.lastSelectedDate = targetDate.toDateString();
      
      // Check if we need to navigate to a different month
      if (targetDate.getMonth() !== this.currentDate.getMonth() || 
          targetDate.getFullYear() !== this.currentDate.getFullYear()) {
        this.currentDate = new Date(targetDate);
        this.renderMonth();
      }

      // Update selection without triggering agenda scroll
      this.updateCalendarSelection(targetDate, false);
    }
  }

  /**
   * Update calendar selection without triggering scroll
   */
  private updateCalendarSelection(
    date: Date,
    shouldScrollToDate: boolean = true
  ): void {
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

    // Only scroll to date if explicitly requested (from calendar click)
    if (shouldScrollToDate) {
      this.scrollToDateInAgenda(date);
    }
  }

  /**
   * Get the first visible date in the agenda
   */
  private getFirstVisibleDate(): string | null {
    const agendaRect = this.agenda.getBoundingClientRect();

    for (const [dateStr, element] of this.visibleDateElements) {
      const elementRect = element.getBoundingClientRect();
      if (
        elementRect.bottom >= agendaRect.top &&
        elementRect.top <= agendaRect.bottom
      ) {
        return dateStr;
      }
    }
    return null;
  }

  /**
   * Update intersection observer to account for CSS transform
   */
  private updateIntersectionObserverForTransform(scrollDiff: number): void {
    // Temporarily disable intersection observer during transform
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    // Re-setup after transform completes
    setTimeout(() => {
      this.setupIntersectionObserver();
    }, 400);
  }

  /**
   * Debounce utility function
   */
  private debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): T {
    let timeout: NodeJS.Timeout | null = null;
    return ((...args: any[]) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    }) as T;
  }
}
