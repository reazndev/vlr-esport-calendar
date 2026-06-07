import { CommonModule } from "@angular/common";
import { HttpClient, HttpClientModule } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";

type Region = { code: string; name: string };
type EventFilter = { id: string; name: string };
type Team = { id?: string; name: string; tag?: string; inactive?: boolean };
type Catalog = {
  regions: Region[];
  eventFilters: EventFilter[];
  teams: Team[];
  feeds: { all: string; mastersChampions: string; custom: string };
};

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent {
  private readonly http = inject(HttpClient);
  private searchRequestId = 0;
  readonly origin = window.location.origin;
  readonly loading = signal(true);
  readonly error = signal("");
  readonly catalog = signal<Catalog | null>(null);
  readonly selectedRegions = signal<Set<string>>(new Set());
  readonly selectedEvents = signal<Set<string>>(new Set());
  readonly selectedTeams = signal<string[]>([]);
  readonly query = signal("");
  readonly searchResults = signal<Team[]>([]);
  readonly searching = signal(false);

  readonly customUrl = computed(() => {
    const params = new URLSearchParams();
    const regions = Array.from(this.selectedRegions());
    const events = Array.from(this.selectedEvents());
    const teams = this.selectedTeams();
    if (regions.length) params.set("regions", regions.join(","));
    if (events.length) params.set("events", events.join(","));
    if (teams.length) params.set("teams", teams.join(","));
    const query = params.toString();
    return `${this.origin}/api/feeds/custom.ics${query ? `?${query}` : ""}`;
  });

  constructor() {
    this.http.get<Catalog>("/api/catalog").subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("The feed API is not reachable.");
        this.loading.set(false);
      }
    });
  }

  fixedFeed(path: string): string {
    return `${this.origin}${path}`;
  }

  toggleRegion(code: string): void {
    this.toggleSet(this.selectedRegions, code);
  }

  toggleEvent(id: string): void {
    this.toggleSet(this.selectedEvents, id);
  }

  isRegionSelected(code: string): boolean {
    return this.selectedRegions().has(code);
  }

  isEventSelected(id: string): boolean {
    return this.selectedEvents().has(id);
  }

  addTeam(name: string): void {
    const team = name.trim();
    if (!team || this.selectedTeams().some((item) => item.toLowerCase() === team.toLowerCase())) {
      return;
    }
    this.selectedTeams.set([...this.selectedTeams(), team]);
    this.query.set("");
    this.searchResults.set([]);
  }

  removeTeam(name: string): void {
    this.selectedTeams.set(this.selectedTeams().filter((team) => team !== name));
  }

  searchTeams(): void {
    const q = this.query().trim();
    const requestId = ++this.searchRequestId;
    if (!q) {
      this.searchResults.set([]);
      this.searching.set(false);
      return;
    }

    this.searchResults.set(this.localTeamMatches(q));
    this.searching.set(true);
    this.http.get<{ teams: Team[] }>(`/api/search/teams?q=${encodeURIComponent(q)}`).subscribe({
      next: ({ teams }) => {
        if (requestId === this.searchRequestId) {
          this.searchResults.set(this.mergeTeams(this.localTeamMatches(q), teams));
          this.searching.set(false);
        }
      },
      error: () => {
        if (requestId === this.searchRequestId) {
          this.searchResults.set(this.localTeamMatches(q));
          this.searching.set(false);
        }
      }
    });
  }

  async copyUrl(): Promise<void> {
    await navigator.clipboard.writeText(this.customUrl());
  }

  private toggleSet(state: ReturnType<typeof signal<Set<string>>>, value: string): void {
    const next = new Set(state());
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    state.set(next);
  }

  private localTeamMatches(query: string): Team[] {
    const normalized = this.normalize(query);
    return (this.catalog()?.teams || [])
      .filter((team) => this.normalize(team.name).includes(normalized) || this.normalize(team.tag).includes(normalized))
      .sort((a, b) => this.scoreTeam(a, normalized) - this.scoreTeam(b, normalized) || a.name.localeCompare(b.name))
      .slice(0, 30);
  }

  private mergeTeams(...groups: Team[][]): Team[] {
    const merged = new Map<string, Team>();
    for (const team of groups.flat()) {
      const key = this.normalize(team.name);
      if (key && !merged.has(key)) {
        merged.set(key, team);
      }
    }
    return Array.from(merged.values()).slice(0, 30);
  }

  private scoreTeam(team: Team, query: string): number {
    const name = this.normalize(team.name);
    const tag = this.normalize(team.tag);
    if (name === query || tag === query) {
      return 0;
    }
    if (name.startsWith(query) || tag.startsWith(query)) {
      return 1;
    }
    return 2;
  }

  private normalize(value: string | undefined): string {
    return String(value || "").trim().toLowerCase();
  }
}
