export const PROJECT_ICON_KEYS = [
  'jira', 'confluence', 'gitlab', 'github', 'jenkins', 'sonarqube',
  'grafana', 'kibana', 'splunk', 'postgresql', 'redis', 'elasticsearch',
  'docker', 'kubernetes', 'openshift', 'aws', 'azure', 'keycloak',
  'nginx', 'angular', 'android', 'apple', 'figma', 'microsoft-teams',
] as const;

export type ProjectIconKey = typeof PROJECT_ICON_KEYS[number];
