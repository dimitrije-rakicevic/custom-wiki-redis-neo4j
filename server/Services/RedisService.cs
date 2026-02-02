using ServiceStack.Redis;
using CustomWiki.Configurations;
using System.Text.Json;
using CustomWiki.DTOs;

namespace CustomWiki.Services;

public class RedisService : IDisposable
{
    private readonly RedisManagerPool _redisManager;

    public RedisService(RedisConfiguration config)
    {
        if (string.IsNullOrEmpty(config.Host))
            throw new ArgumentException("Redis Host is required");
        if (string.IsNullOrEmpty(config.Password))
            throw new ArgumentException("Redis Password is required");

        var connectionString = config.GetConnectionString();
        _redisManager = new RedisManagerPool(connectionString);

    }

    public void PublishMessage(string wikiId, string userId, string username, string message)
    {
        using var client = _redisManager.GetClient();

        var messageData = new
        {
            userId,
            username,
            message,
            timestamp = DateTime.UtcNow
        };

        var key = $"wiki:{wikiId}:history";
        var json = JsonSerializer.Serialize(messageData);

        client.AddItemToList(key, json);

        client.TrimList(key, 0, 999);
    }

    public List<ChatMessage> GetChatHistory(string wikiId, int count = 50)
    {
        using var client = _redisManager.GetClient();

        var key = $"wiki:{wikiId}:history";
        var messages = client.GetRangeFromList(key, -count, -1);

        var chatMessages = new List<ChatMessage>();
        foreach (var msg in messages)
        {
            try
            {
                var data = JsonSerializer.Deserialize<ChatMessage>(msg);
                if (data != null)
                    chatMessages.Add(data);
            }
            catch(Exception e)
            {
                Console.WriteLine(e.Message);
            }
        }

        return chatMessages;
    }

    public void AddUserOnline(string wikiId, string userId)
    {
        using var client = _redisManager.GetClient();

        var key = $"wiki:{wikiId}:online";
        var score = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        client.AddItemToSortedSet(key, userId, score);
    }

    public void RemoveUserOffline(string wikiId, string userId)
    {
        using var client = _redisManager.GetClient();

        var key = $"wiki:{wikiId}:online";
        client.RemoveItemFromSortedSet(key, userId);
    }

    public void RemoveInactiveUsers(string wikiId, int timeoutMinutes = 5)
    {
        using var client = _redisManager.GetClient();

        var key = $"wiki:{wikiId}:online";
        var cutoff = DateTimeOffset.UtcNow.AddMinutes(-timeoutMinutes).ToUnixTimeSeconds();

        client.RemoveRangeFromSortedSetByScore(key, 0, cutoff);
    }

    public void RemoveWikiData(string wikiId)
    {
        using var client = _redisManager.GetClient();

        client.Remove($"wiki:{wikiId}:history");
        client.Remove($"wiki:{wikiId}:online");
        client.Remove($"wiki:{wikiId}:typing");
        client.Remove($"wiki:{wikiId}:views");
    }

    public long GetOnlineCount(string wikiId)
    {
        using var client = _redisManager.GetClient();

        var key = $"wiki:{wikiId}:online";
        var cutoff = DateTimeOffset.UtcNow.AddMinutes(-5).ToUnixTimeSeconds();
        client.RemoveRangeFromSortedSetByScore(key, 0, cutoff);

        return client.GetSortedSetCount(key);
    }

    public List<string> GetOnlineUsers(string wikiId)
    {
        using var client = _redisManager.GetClient();

        var key = $"wiki:{wikiId}:online";
        var cutoff = DateTimeOffset.UtcNow.AddMinutes(-5).ToUnixTimeSeconds();
        client.RemoveRangeFromSortedSetByScore(key, 0, cutoff);

        return client.GetAllItemsFromSortedSet(key).ToList();
    }

    public void SetUserTyping(string wikiId, string userId, int ttlSeconds = 3)
    {
        using var client = _redisManager.GetClient();

        var key = $"wiki:{wikiId}:typing";
        client.AddItemToSet(key, userId);
        client.ExpireEntryIn(key, TimeSpan.FromSeconds(ttlSeconds));
    }

    public List<string> GetTypingUsers(string wikiId)
    {
        using var client = _redisManager.GetClient();

        var key = $"wiki:{wikiId}:typing";
        var users = client.GetAllItemsFromSet(key);
        return users.ToList();
    }

    public void IncrementWikiView(string wikiId)
    {
        using var client = _redisManager.GetClient();

        var key = "trending:wikis";
        client.IncrementItemInSortedSet(key, wikiId, 1);

        client.ExpireEntryIn(key, TimeSpan.FromDays(7));
    }

    public List<string> GetTrendingWikis(int count = 10)
    {
        using var client = _redisManager.GetClient();

        var key = "trending:wikis";
        var wikis = client.GetRangeFromSortedSetDesc(key, 0, count - 1);
        return wikis.ToList();
    }

    public void Dispose()
    {
        _redisManager?.Dispose();
    }
}