export type TaskStatus = "Todo" | "InProgress" | "Stopped" | "Done";

export interface IProgressData {
  totalTime: string;
  elapsedTime: string;
  remainingTime: string;
  progressPercentage: number;
}

export interface ITaskinoItem {
  id: string;
  isDone: boolean;
  name: string;
}

export interface ITaskino {
  items: ITaskinoItem[];
}

export interface ITask {
  id: string;
  title: string;
  badge?: string;
  status: TaskStatus;
  progress: IProgressData;
  user?: string;
  priority?: "low" | "medium" | "high" | string;
  path?: string[];
  skillType?: "FrontEnd" | "BackEnd" | "Design" | string;
  subStoryId?: string;
  taskino?: ITaskino;
  isReferred?: boolean;
  referralMessage?: string | null;
  isInPerson?: boolean;
  isDraft?: boolean;
}

export interface IExecuteBoardResponse {
  isSuccess?: boolean;
  errorMessage?: string;
  errors?: string[];
  errorType?: string;
  data?: {
    items?: ITask[];
  };
  items?: ITask[];
}

export interface ILoginResponse {
  jwtAccessToken: string;
  jwtRefreshToken: string;
  accountType: string;
  success: boolean;
  message?: string;
  workshopSlug?: string;
  accountId: number;
  accountFullName: string;
}
