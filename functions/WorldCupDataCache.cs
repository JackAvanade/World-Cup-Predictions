using Azure;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Logging;
using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace WorldCup.Functions
{
    public class WorldCupDataCache
    {
        private readonly BlobClient _blobClient;
        private readonly ILogger<WorldCupDataCache> _logger;
        private string _cachedData = string.Empty;
        private DateTimeOffset _lastRefreshed = DateTimeOffset.MinValue;
        private readonly TimeSpan _refreshInterval = TimeSpan.FromHours(1);
        private readonly SemaphoreSlim _refreshLock = new(1, 1);

        public WorldCupDataCache(string storageConnectionString, string containerName, string blobName, ILogger<WorldCupDataCache> logger)
        {
            _logger = logger;
            var blobServiceClient = new BlobServiceClient(storageConnectionString);
            var containerClient = blobServiceClient.GetBlobContainerClient(containerName);
            _blobClient = containerClient.GetBlobClient(blobName);
        }

        public async Task<string> GetLatestDataAsync(CancellationToken cancellationToken)
        {
            if (DateTimeOffset.UtcNow - _lastRefreshed > _refreshInterval || string.IsNullOrEmpty(_cachedData))
            {
                await RefreshAsync(cancellationToken);
            }

            return _cachedData;
        }

        public async Task RefreshAsync(CancellationToken cancellationToken)
        {
            await _refreshLock.WaitAsync(cancellationToken);
            try
            {
                if (DateTimeOffset.UtcNow - _lastRefreshed <= _refreshInterval && !string.IsNullOrEmpty(_cachedData))
                {
                    return;
                }

                _logger.LogInformation("Refreshing World Cup data from blob storage.");

                var response = await _blobClient.DownloadContentAsync(cancellationToken);
                var content = response.Value.Content.ToString();
                _cachedData = content;
                _lastRefreshed = DateTimeOffset.UtcNow;
            }
            catch (RequestFailedException ex)
            {
                _logger.LogError(ex, "Failed to refresh blob data.");
                throw;
            }
            finally
            {
                _refreshLock.Release();
            }
        }
    }
}