import { ModelDetails } from "./ModelDetails";

export interface AIModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: ModelDetails;
  capabilities: string[];
}