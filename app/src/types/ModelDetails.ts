export interface ModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[] | null;
  parameter_size: string;
  quantization_level: string;
  context_length: number;
  embedding_length: number;
}
