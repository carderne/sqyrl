export class ParseError extends Error {
  readonly type = "parse_error";
}

export class SanitiseError extends Error {
  readonly type = "sanitise_error";
}

export class AgentSqlError extends Error {
  readonly type = "agent_sql_error";
}
