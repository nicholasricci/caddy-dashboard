export type JsonObject = Record<string, unknown>;

export interface CaddyHttpConfig {
  apps?: {
    http?: {
      servers?: Record<string, CaddyHttpServer>;
    };
  };
}

export interface CaddyHttpServer {
  listen?: string[];
  routes?: CaddyRoute[];
  read_timeout?: string;
  idle_timeout?: string;
}

export interface CaddyRoute {
  match?: CaddyMatchSet[];
  handle?: CaddyHandler[];
  terminal?: boolean;
  group?: string;
}

export interface CaddyMatchSet {
  host?: string[];
  path?: string[];
  method?: string[];
  query?: Record<string, string[]>;
  header?: Record<string, string[]>;
  protocol?: string;
}

interface CaddyHandlerBase {
  handler: string;
}

export interface ReverseProxyHandler extends CaddyHandlerBase {
  handler: 'reverse_proxy';
  upstreams?: { dial: string }[];
  headers?: {
    request?: JsonObject;
    response?: JsonObject;
  };
  transport?: JsonObject;
}

export interface StaticResponseHandler extends CaddyHandlerBase {
  handler: 'static_response';
  status_code?: number;
  body?: string;
  headers?: Record<string, string[]>;
}

export interface FileServerHandler extends CaddyHandlerBase {
  handler: 'file_server';
  root?: string;
  browse?: boolean;
  hide?: string[];
}

export interface SubrouteHandler extends CaddyHandlerBase {
  handler: 'subroute';
  routes?: CaddyRoute[];
}

export type CaddyHandler =
  | ReverseProxyHandler
  | StaticResponseHandler
  | FileServerHandler
  | SubrouteHandler
  | (CaddyHandlerBase & JsonObject);
