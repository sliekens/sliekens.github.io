export interface Profile {
  login: string;
  name: string;
  avatarUrl: string;
  bio: string;
  company: string;
  location: string;
  blog: string;
  htmlUrl: string;
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: string;
}

export interface Repo {
  name: string;
  description: string;
  htmlUrl: string;
  homepage: string;
  stars: number;
  forks: number;
  language: string;
  languageColor: string;
  topics: string[];
  pushedAt: string;
  createdAt: string;
  hasPages: boolean;
  archived: boolean;
  isFork: boolean;
  openIssues: number;
  pinned: boolean;
}

export type ActivityType =
  | 'push'
  | 'pr'
  | 'review'
  | 'issue'
  | 'comment'
  | 'create'
  | 'delete'
  | 'star'
  | 'fork'
  | 'release'
  | 'wiki'
  | 'public';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  repo: string;
  title: string;
  detail: string;
  url: string;
  createdAt: string;
}

export interface CalendarDay {
  date: string;
  count: number;
}

export interface CalendarWeek {
  days: CalendarDay[];
}

export interface ContributionCalendar {
  total: number;
  weeks: CalendarWeek[];
  /** graphql = real data, derived = approximated from public events, none = placeholder */
  source: 'graphql' | 'derived' | 'none';
}

export interface LanguageStat {
  name: string;
  color: string;
  repoCount: number;
}

export interface GithubData {
  generatedAt: string;
  profile: Profile;
  repos: Repo[];
  totalStars: number;
  events: ActivityItem[];
  calendar: ContributionCalendar;
  languages: LanguageStat[];
}
