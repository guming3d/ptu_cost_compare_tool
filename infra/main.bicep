targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('AZD environment name used to generate resource names.')
param environmentName string

@minLength(1)
@description('Primary Azure location for all resources.')
param location string

@description('Whether the web Container App already exists.')
param webExists bool = false

var normalizedEnvironmentName = toLower(replace(environmentName, '_', '-'))
var resourceToken = toLower(take(uniqueString(subscription().id, environmentName, location), 8))
var resourceGroupName = take('rg-${normalizedEnvironmentName}-${resourceToken}', 90)
var tags = {
  'azd-env-name': environmentName
  application: 'ptu-cost-compare-tool'
  environment: 'development'
  'managed-by': 'azd'
}

resource resourceGroup 'Microsoft.Resources/resourceGroups@2025-04-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module resources './modules/resources.bicep' = {
  name: 'resources'
  scope: resourceGroup
  params: {
    environmentName: environmentName
    location: location
    serviceName: 'web'
    tags: tags
    webExists: webExists
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = resources.outputs.registryName
output AZURE_CONTAINER_ENVIRONMENT_NAME string = resources.outputs.environmentName
output WEB_URL string = resources.outputs.webUrl
