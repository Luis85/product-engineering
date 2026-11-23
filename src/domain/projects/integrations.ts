import { Schema } from "effect";
import { text } from "../notes";

export const projectDataClasses = ["internal", "public", "confidential"] as const;
export const projectDataClassSchema = Schema.Literals(projectDataClasses);
export type ProjectDataClass = typeof projectDataClassSchema.Type;
export const isProjectDataClass = Schema.is(projectDataClassSchema);
export const projectDataClassField = text({
  schema: projectDataClassSchema,
  issue: "data_class.invalid",
});
