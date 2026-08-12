targetScope = 'resourceGroup'

@description('AZD environment name used to generate resource names.')
param environmentName string

@description('Primary Azure location for all resources.')
param location string

@description('AZD service name. Must match azure.yaml.')
param serviceName string

@description('Tags applied to all resources.')
param tags object

@description('Whether the web Container App already exists.')
param webExists bool

var environmentStem = take(toLower(replace(environmentName, '_', '-')), 18)
var resourceToken = toLower(take(uniqueString(subscription().id, resourceGroup().id, environmentName, location), 8))
var compactStem = replace(environmentStem, '-', '')
var logAnalyticsName = take('log-${environmentStem}-${resourceToken}', 63)
var appInsightsName = take('appi-${environmentStem}-${resourceToken}', 260)
var containerEnvironmentName = take('cae-${environmentStem}-${resourceToken}', 60)
var registryName = take('acr${compactStem}${resourceToken}', 50)
var containerAppName = take('ca-${environmentStem}-${resourceToken}', 32)

module logAnalytics 'br/public:avm/res/operational-insights/workspace:0.16.0' = {
  name: 'log-analytics'
  params: {
    name: logAnalyticsName
    location: location
    skuName: 'PerGB2018'
    dataRetention: 30
    dailyQuotaGb: '1'
    forceCmkForQuery: false
    features: {
      disableLocalAuth: true
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    tags: tags
    enableTelemetry: false
  }
}

module appInsights 'br/public:avm/res/insights/component:0.8.0' = {
  name: 'application-insights'
  params: {
    name: appInsightsName
    location: location
    workspaceResourceId: logAnalytics.outputs.resourceId
    disableLocalAuth: true
    retentionInDays: 30
    samplingPercentage: 100
    tags: tags
    enableTelemetry: false
  }
}

module containerAppsStack 'br/public:avm/ptn/azd/container-apps-stack:0.4.0' = {
  name: 'container-apps-stack'
  params: {
    containerAppsEnvironmentName: containerEnvironmentName
    containerRegistryName: registryName
    logAnalyticsWorkspaceName: logAnalytics.outputs.name
    location: location
    acrAdminUserEnabled: false
    acrSku: 'Basic'
    publicNetworkAccess: 'Enabled'
    zoneRedundant: false
    tags: tags
    enableTelemetry: false
  }
}

resource existingWeb 'Microsoft.App/containerApps@2026-01-01' existing = if (webExists) {
  name: containerAppName
}

var webImage = webExists
  ? existingWeb!.properties.template.containers[0].image
  : 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

module web 'br/public:avm/res/app/container-app:0.23.0' = {
  name: serviceName
  params: {
    name: containerAppName
    location: location
    environmentResourceId: containerAppsStack.outputs.environmentResourceId
    tags: union(tags, {
      'azd-service-name': serviceName
    })
    managedIdentities: {
      systemAssigned: true
    }
    registries: [
      {
        server: containerAppsStack.outputs.registryLoginServer
        identity: 'system'
      }
    ]
    activeRevisionsMode: 'Single'
    ingressExternal: true
    ingressAllowInsecure: false
    ingressTargetPort: 80
    ingressTransport: 'auto'
    maxInactiveRevisions: 3
    scaleSettings: {
      minReplicas: 0
      maxReplicas: 2
    }
    containers: [
      {
        name: serviceName
        image: webImage
        resources: {
          cpu: json('0.25')
          memory: '0.5Gi'
        }
        probes: [
          {
            type: 'Startup'
            httpGet: {
              path: '/'
              port: 80
              scheme: 'HTTP'
            }
            periodSeconds: 5
            timeoutSeconds: 2
            failureThreshold: 12
          }
          {
            type: 'Readiness'
            httpGet: {
              path: '/'
              port: 80
              scheme: 'HTTP'
            }
            initialDelaySeconds: 2
            periodSeconds: 10
            timeoutSeconds: 2
            failureThreshold: 3
          }
          {
            type: 'Liveness'
            httpGet: {
              path: '/'
              port: 80
              scheme: 'HTTP'
            }
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 2
            failureThreshold: 3
          }
        ]
      }
    ]
    diagnosticSettings: [
      {
        name: 'send-to-log-analytics'
        workspaceResourceId: logAnalytics.outputs.resourceId
      }
    ]
    enableTelemetry: false
  }
}

module acrPull './acr-pull-role.bicep' = {
  name: 'web-acr-pull'
  params: {
    registryName: containerAppsStack.outputs.registryName
    principalId: web.outputs.systemAssignedMIPrincipalId!
  }
}

output environmentName string = containerAppsStack.outputs.environmentName
output registryLoginServer string = containerAppsStack.outputs.registryLoginServer
output registryName string = containerAppsStack.outputs.registryName
output webUrl string = 'https://${web.outputs.fqdn}'
