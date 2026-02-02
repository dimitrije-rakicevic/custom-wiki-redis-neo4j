using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using CustomWiki.Services;
using CustomWiki.Models;

namespace CustomWiki.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly RedisService _redis;
    private readonly Neo4jService _neo4j;

    public ChatHub(RedisService redis, Neo4jService neo4j)
    {
        _redis = redis;
        _neo4j = neo4j;
    }

    private string GetUserId() => Context.User?.FindFirst("UserId")?.Value ?? "";
    private string GetUsername() => Context.User?.Identity?.Name ?? "Anonymous";

    public async Task JoinWiki(string wikiId)
    {
        var client = await _neo4j.GetClientAsync();

        var userId = GetUserId();
        var username = GetUsername();

        var isSubscribed = await client.Cypher
            .Match("(u:User)-[r:SUBSCRIBED_TO]->(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Return(r => r.As<object>())
            .ResultsAsync;

        if (!isSubscribed.Any())
        {
            await Clients.Caller.SendAsync("Error", new { message = "You must be subscribed to this wiki to join the chat" });
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, wikiId);
        
        _redis.AddUserOnline(wikiId, userId);
        
        await Clients.Group(wikiId).SendAsync("UserJoined", new { userId, username });
        
        var count = _redis.GetOnlineCount(wikiId);
        await Clients.Group(wikiId).SendAsync("OnlineCountUpdated", count);
    }

    public async Task LeaveWiki(string wikiId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, wikiId);
        
        var userId = GetUserId();
        var username = GetUsername();
        _redis.RemoveUserOffline(wikiId, userId);
        
        await Clients.Group(wikiId).SendAsync("UserLeft", new { userId, username });
        
        var count = _redis.GetOnlineCount(wikiId);
        await Clients.Group(wikiId).SendAsync("OnlineCountUpdated", count);
    }

    public async Task SendMessage(string wikiId, string message)
    {
        var userId = GetUserId();
        var username = GetUsername();

        _redis.PublishMessage(wikiId, userId, username, message);

        await Clients.Group(wikiId).SendAsync("ReceiveMessage", new
        {
            userId,
            username,
            message,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task SendTyping(string wikiId)
    {
        var userId = GetUserId();
        var username = GetUsername();

        _redis.SetUserTyping(wikiId, userId, 3);

        await Clients.OthersInGroup(wikiId).SendAsync("UserTyping", new { userId, username });
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}