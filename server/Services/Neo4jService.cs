using CustomWiki.Configurations;
using Neo4jClient;

namespace CustomWiki.Services;

public class Neo4jService
{
    private readonly IGraphClient _client;
    private readonly SemaphoreSlim _connectionLock = new SemaphoreSlim(1, 1);
    private bool _isConnected = false;

    public Neo4jService(Neo4jConfiguration config)
    {
        config.Validate();

        _client = new BoltGraphClient(
            new Uri(config.Uri!),
            config.Username,
            config.Password
        );
    }

    private async Task EnsureConnectedAsync()
    {
        if (_isConnected) return;

        await _connectionLock.WaitAsync();
        try
        {
            if (!_isConnected)
            {
                await _client.ConnectAsync();
                _isConnected = true;
            }
        }
        finally
        {
            _connectionLock.Release();
        }
    }

    public async Task<IGraphClient> GetClientAsync()
    {
        await EnsureConnectedAsync();
        return _client;
    }
}