import { randomUUID } from "node:crypto";

export interface CloudEvent<T = unknown> {
  specversion: "1.0";
  id: string;
  source: string;
  type: string;
  time: string;
  datacontenttype: "application/json";
  data: T;
}

export const EventTypes = {
  ENTITY_CREATED: "conveyx.customer.entity.created",
  ENTITY_UPDATED: "conveyx.customer.entity.updated",
  USER_CREATED: "conveyx.identity.user.created",
  TEAM_MEMBERSHIP_CHANGED: "conveyx.identity.team.membership_changed",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export interface EntityCreatedData {
  entity_id: string;
  entity_type: "master" | "branch";
  name: string;
}

export interface UserCreatedData {
  user_id: string;
  entity_id: string;
  email: string;
}

export function createCloudEvent<T>(
  type: string,
  source: string,
  data: T,
  id?: string
): CloudEvent<T> {
  return {
    specversion: "1.0",
    id: id ?? randomUUID(),
    source,
    type,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    data,
  };
}
