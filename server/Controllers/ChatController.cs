using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CustomWiki.Services;
using CustomWiki.DTOs;
using CustomWiki.Models;

namespace CustomWiki.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly RedisService _redis;
    private readonly Neo4jService _neo4j;

    public ChatController(RedisService redis, Neo4jService neo4j)
    {
        _redis = redis;
        _neo4j = neo4j;
    }

    private string GetUserId() => User.FindFirst("UserId")?.Value ?? "";
    private string GetUsername() => User.Identity?.Name ?? "Anonymous";
    
    [HttpGet("{wikiId}/history")]
    public async Task<ActionResult> GetHistory(string wikiId, [FromQuery] int count = 50)
    {
        var messages = _redis.GetChatHistory(wikiId, count);
        return Ok(new { wikiId, count = messages.Count, messages });
    }

    [HttpPost("{wikiId}/message")]
    public async Task<ActionResult> SendMessage(string wikiId, [FromBody] SendMessageRequest request)
    {
        var userId = GetUserId();
        var username = GetUsername();

        _redis.PublishMessage(wikiId, userId, username, request.Message);

        return Ok(new { message = "Message sent", userId, username });
    }

    [HttpGet("{wikiId}/online")]
    public async Task<ActionResult> GetOnlineUsers(string wikiId)
    {
        var userIds = _redis.GetOnlineUsers(wikiId);
        var count = _redis.GetOnlineCount(wikiId);

        if (userIds.Count == 0)
            return Ok(new { wikiId, onlineCount = 0, users = new List<object>() });

        var client = await _neo4j.GetClientAsync();
        var users = await client.Cypher
            .Match("(u:User)")
            .Where("u.Id IN $userIds")
            .WithParam("userIds", userIds)
            .Return(u => new
            {
                u.As<User>().Id,
                u.As<User>().Username
            })
            .ResultsAsync;

        return Ok(new { wikiId, onlineCount = count, users = users.ToList() });
    }

    [HttpPost("{wikiId}/online")]
    public async Task<ActionResult> MarkOnline(string wikiId)
    {
        var userId = GetUserId();
        _redis.AddUserOnline(wikiId, userId);

        return Ok(new { message = "Marked as online", userId });
    }

    [HttpDelete("{wikiId}/online")]
    public async Task<ActionResult> MarkOffline(string wikiId)
    {
        var userId = GetUserId();
        _redis.RemoveUserOffline(wikiId, userId);

        return Ok(new { message = "Marked as offline", userId });
    }

    [HttpPost("{wikiId}/typing")]
    public async Task<ActionResult> SetTyping(string wikiId)
    {
        var userId = GetUserId();
        _redis.SetUserTyping(wikiId, userId, 3);
        return Ok(new { message = "Typing indicator set", userId });
    }

    [HttpGet("{wikiId}/typing")]
    public async Task<ActionResult> GetTypingUsers(string wikiId)
    {
        var userIds = _redis.GetTypingUsers(wikiId);
        return Ok(new { wikiId, typingUserIds = userIds });
    }
}