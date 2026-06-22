using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Extensions.Timer;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Threading;
using System.Threading.Tasks;

namespace WorldCup.Functions
{
    public class WorldCupFunctionApp
    {
        private readonly WorldCupDataCache _dataCache;
        private readonly WorldCupAIService _aiService;
        private readonly ILogger<WorldCupFunctionApp> _logger;

        public WorldCupFunctionApp(WorldCupDataCache dataCache, WorldCupAIService aiService, ILogger<WorldCupFunctionApp> logger)
        {
            _dataCache = dataCache;
            _aiService = aiService;
            _logger = logger;
        }

        [Function("GetWorldCupAnalysis")]
        public async Task<HttpResponseData> GetWorldCupAnalysisAsync([HttpTrigger(AuthorizationLevel.Function, "get", Route = "worldcup/analysis")] HttpRequestData req)
        {
            _logger.LogInformation("Request received for world cup analysis.");

            var data = await _dataCache.GetLatestDataAsync(req.CancellationToken);
            var analysis = await _aiService.AnalyzeAsync(data);

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "text/plain; charset=utf-8");
            response.WriteString(analysis);
            return response;
        }

        [Function("RefreshWorldCupData")]
        public async Task RefreshWorldCupDataAsync([TimerTrigger("0 0 * * * *")] TimerInfo timerInfo)
        {
            _logger.LogInformation("Hourly timer triggered: refreshing world cup blob data.");
            await _dataCache.RefreshAsync(CancellationToken.None);
        }
    }
}