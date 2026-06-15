export const schemas = {
  database: {
    fields: {
      host: {
        type: "string",
      },
      port: {
        type: "number",
      },
      user: {
        type: "string",
      },
      password: {
        type: "string",
      },
      database: {
        type: "string",
      },
      domain: {
        type: "string",
      },
      provider: {
        type: ["postgres", "mysql"],
      },
    },
  },
}
