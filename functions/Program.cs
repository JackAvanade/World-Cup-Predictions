using Azure.Storage.Blobs;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;

namespace WorldCup.Functions
{
    public class Program
    {
        public static void Main()
        {
            var host = new HostBuilder()
                .ConfigureFunctionsWorkerDefaults()
                .ConfigureServices((context, services) =>
                {
                    services.AddSingleton<WorldCupDataCache>(provider =>
                    {
                        var logger = provider.GetRequiredService<ILogger<WorldCupDataCache>>();
                        var connectionString = Environment.GetEnvironmentVariable("BLOB_STORAGE_CONNECTION_STRING")
                            ?? Environment.GetEnvironmentVariable("AzureWebJobsStorage");
                        var containerName = Environment.GetEnvironmentVariable("BLOB_CONTAINER_NAME") ?? "worldcup-data";
                        var blobName = Environment.GetEnvironmentVariable("BLOB_NAME") ?? "fixtures.json";

                        return new WorldCupDataCache(connectionString, containerName, blobName, logger);
                    });

                    services.AddSingleton<WorldCupAIService>();
                })
                .Build();

            host.Run();
        }
    }
}