param(
    [string] $SubscriptionId = '',
    [string] $ResourceGroupName = 'wc-prediction-rg',
    [string] $Location = 'eastus',
    [string] $FunctionAppName = "wcpredictionfunc$(Get-Random -Minimum 1000 -Maximum 9999)",
    [string] $StorageAccountName = "wcpredictionst$(Get-Random -Minimum 1000 -Maximum 9999)"
)

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error 'Azure CLI is not installed or not on PATH. Install it from https://learn.microsoft.com/cli/azure/install-azure-cli and sign in with az login.'
    exit 1
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Error 'dotnet SDK is not installed or not on PATH.'
    exit 1
}

if ($SubscriptionId) {
    Write-Host "Setting Azure subscription to $SubscriptionId"
    az account set --subscription $SubscriptionId | Out-Null
}

$activeSubscription = az account show --query id -o tsv
Write-Host "Active subscription: $activeSubscription"

Write-Host "Creating resource group $ResourceGroupName in $Location"
az group create --name $ResourceGroupName --location $Location | Out-Null

Write-Host "Creating storage account $StorageAccountName"
az storage account create --name $StorageAccountName --resource-group $ResourceGroupName --location $Location --sku Standard_LRS --kind StorageV2 | Out-Null

Write-Host "Creating Function App $FunctionAppName"
az functionapp create --name $FunctionAppName --resource-group $ResourceGroupName --storage-account $StorageAccountName --consumption-plan-location $Location --runtime dotnet --functions-version 4 --os-type Linux | Out-Null

Write-Host 'Publishing the function project'
dotnet publish -c Release -o publish

if (Test-Path publish.zip) { Remove-Item publish.zip -Force }
Compress-Archive -Path publish\* -DestinationPath publish.zip -Force

Write-Host "Deploying package to Function App $FunctionAppName"
az functionapp deployment source config-zip --resource-group $ResourceGroupName --name $FunctionAppName --src publish.zip | Out-Null

Write-Host "Deployment complete. Function App name: $FunctionAppName"
Write-Host "Resource group: $ResourceGroupName"
Write-Host "Storage account: $StorageAccountName"
Write-Host "To get the function URL, run: az functionapp function show --resource-group $ResourceGroupName --name $FunctionAppName --function-name GetFixtures --query invokeUrlTemplate -o tsv"