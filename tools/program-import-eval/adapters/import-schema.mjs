/**
 * Shared strict API response schema. Strict OpenAI schemas require every declared
 * property; nullable numeric fields therefore represent genuinely absent values.
 * Taurifer's existing gap reader accepts null and turns it into an explicit gap,
 * while its complete parser continues rejecting incomplete rows.
 * No provider schema becomes an alternative source of product truth.
 */
const row = {
  type:"object",additionalProperties:false,
  properties:{
    day:{type:"string"},order:{type:"integer"},name:{type:"string"},
    sets:{type:["integer","null"]},
    min:{type:["integer","null"]},
    max:{type:["integer","null"]}
  },
  required:["day","order","name","sets","min","max"]
};
const missing = {
  type:"object",additionalProperties:false,
  properties:{
    day:{type:"string"},order:{type:"integer"},
    field:{type:"string",enum:["sets","reps"]}
  },
  required:["day","order","field"]
};
export const IMPORT_SCHEMA = Object.freeze({
  type:"object",additionalProperties:false,
  properties:{
    version:{type:"integer",enum:[3]},
    meta:{type:"object",additionalProperties:false,
      properties:{name:{type:"string"}},required:["name"]},
    exercises:{type:"array",items:row},
    missing:{type:"array",items:missing},
    notImported:{type:"array",items:{type:"string",enum:[
      "rest_times","rir_rpe","tempo","supersets","warmups",
      "cardio","progression_rules","deload","other_notes"
    ]}}
  },
  required:["version","meta","exercises","missing","notImported"]
});
