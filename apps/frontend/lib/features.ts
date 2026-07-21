export const FEATURES = {
  MULTI_FLOW_UI: (process.env.NEXT_PUBLIC_ENABLE_MULTI_FLOW_UI ?? 'true') === 'true',
  DRILLDOWN_UI: (process.env.NEXT_PUBLIC_ENABLE_DRILLDOWN_UI ?? 'false') === 'true',
} as const;
