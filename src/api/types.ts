import type { components } from './schema'
type Complete<T> = T extends (infer U)[]
  ? Complete<U>[]
  : T extends object
    ? { [K in keyof T]-?: Complete<NonNullable<T[K]>> }
    : T
// ProtoJSON EmitUnpopulated emits response fields, including empty arrays and zero values.
type Model<K extends keyof components['schemas']> = Complete<components['schemas'][K]>
export type Staff = Model<'Admin_matchlab_admin_v1_StaffAccount'>
export type Login = Model<'Admin_matchlab_admin_v1_LoginResult'>
export type Ticket = Model<'Admin_matchlab_support_v1_Ticket'>
export type Achievement = Model<'Admin_matchlab_user_v1_Achievement'>
export type User = Model<'Admin_matchlab_user_v1_ManagedUser'>
export type Domain = Model<'Admin_matchlab_user_v1_EmailDomain'>
export type Project = Model<'Admin_matchlab_project_v1_Project'>
export type Event = Model<'Admin_matchlab_management_v1_Event'>
export type Decision = Model<'Admin_matchlab_user_v1_AchievementDecision'>
export type Moderation = Model<'Admin_matchlab_project_v1_ModerationRecord'>
export type Stats = Model<'Admin_matchlab_admin_v1_AdminStatistics'>
export type Statistics = Model<'Admin_matchlab_management_v1_Statistics'>
export type Download = Model<'Admin_matchlab_management_v1_Download'>
export type List<T> = { items: T[]; total: string }
export type Session = { token: string; expires: number }
