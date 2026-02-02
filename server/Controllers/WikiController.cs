using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CustomWiki.Models;
using CustomWiki.Services;
using CustomWiki.DTOs;

namespace CustomWiki.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WikiController : ControllerBase
{
    private readonly Neo4jService _neo4j;
    private readonly RedisService _redis;

    public WikiController(Neo4jService neo4j, RedisService redis)
    {
        _neo4j = neo4j;
        _redis = redis;
    }

    private string GetUserId() => User.FindFirst("UserId")?.Value ?? "";

    [HttpPost]
    public async Task<ActionResult> CreateWiki([FromBody] CreateWikiRequest request)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var wiki = new Wiki
        {
            Id = Guid.NewGuid().ToString(),
            Name = request.Name,
            Description = request.Description,
            IsPrivate = request.IsPrivate,
            CreatedAt = DateTime.UtcNow
        };

        var result = await client.Cypher
            .Match("(owner:User)")
            .Where((User owner) => owner.Id == userId)
            .Create("(w:Wiki $wiki)")
            .WithParam("wiki", wiki)
            .Create("(owner)-[:OWNS]->(w)")
            .Create("(owner)-[:SUBSCRIBED_TO]->(w)")
            .Return((w, owner) => new
            {
                Wiki = w.As<Wiki>(),
                OwnerUsername = owner.As<User>().Username
            })
            .ResultsAsync;

        var data = result.First();
        data.Wiki.OwnerUsername = data.OwnerUsername;
        data.Wiki.SubscriberCount = 1;

        return Ok(data.Wiki);
    }

    [HttpPut("{wikiId}")]
    public async Task<ActionResult> UpdateWiki(string wikiId, [FromBody] UpdateWikiRequest request)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var ownerCheck = await client.Cypher
            .Match("(u:User)-[:OWNS]->(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Return(w => w.As<Wiki>())
            .ResultsAsync;

        if (!ownerCheck.Any())
            return Forbid("You do not own this wiki.");

        var result = await client.Cypher
            .Match("(w:Wiki)", "(owner:User)-[:OWNS]->(w)")
            .Where((Wiki w) => w.Id == wikiId)
            .Set("w.Name = $name, w.Description = $description, w.IsPrivate = $isPrivate")
            .WithParam("name", request.Name)
            .WithParam("description", request.Description)
            .WithParam("isPrivate", request.IsPrivate)
            .With("w, owner")
            .OptionalMatch("(subscriber:User)-[:SUBSCRIBED_TO]->(w)")
            .With("w, owner, COUNT(DISTINCT subscriber) as subCount")
            .Return((w, owner, subCount) => new
            {
                Wiki = w.As<Wiki>(),
                OwnerUsername = owner.As<User>().Username,
                SubCount = subCount.As<int>()
            })
            .ResultsAsync;

        var data = result.FirstOrDefault();
        if (data == null)
            return NotFound(new { message = "Wiki not found" });

        data.Wiki.OwnerUsername = data.OwnerUsername;
        data.Wiki.SubscriberCount = data.SubCount;
        data.Wiki.IsOwner = true;

        return Ok(data.Wiki);
    }

    [HttpDelete("{wikiId}")]
    public async Task<ActionResult> DeleteWiki(string wikiId)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var ownerCheck = await client.Cypher
            .Match("(u:User)-[:OWNS]->(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Return(w => w.As<Wiki>())
            .ResultsAsync;

        if (!ownerCheck.Any())
            return Forbid("You do not own this wiki.");

        await client.Cypher
            .Match("(p:WikiPage)-[:BELONGS_TO]->(w:Wiki)")
            .Where((Wiki w) => w.Id == wikiId)
            .DetachDelete("p")
            .ExecuteWithoutResultsAsync();

        await client.Cypher
            .Match("(w:Wiki)")
            .Where((Wiki w) => w.Id == wikiId)
            .DetachDelete("w")
            .ExecuteWithoutResultsAsync();

        _redis.RemoveWikiData(wikiId);

        return Ok(new { message = "Wiki deleted successfully" });
    }

    [HttpGet("{wikiId}")]
    public async Task<ActionResult> GetWiki(string wikiId)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var result = await client.Cypher
            .Match("(w:Wiki)", "(owner:User)-[:OWNS]->(w)")
            .Where((Wiki w) => w.Id == wikiId)
            .OptionalMatch("(subscriber:User)-[:SUBSCRIBED_TO]->(w)")
            .OptionalMatch("(page:WikiPage)-[:BELONGS_TO]->(w)")
            .With("w, owner, COUNT(DISTINCT subscriber) as subCount, COUNT(DISTINCT page) as pageCount")
            .Return((w, owner, subCount, pageCount) => new
            {
                Wiki = w.As<Wiki>(),
                OwnerUsername = owner.As<User>().Username,
                SubCount = subCount.As<int>(),
                PageCount = pageCount.As<int>()
            })
            .ResultsAsync;

        var data = result.FirstOrDefault();
        if (data == null)
            return NotFound(new { message = "Wiki not found" });

        data.Wiki.OwnerUsername = data.OwnerUsername;
        data.Wiki.SubscriberCount = data.SubCount;
        data.Wiki.PageCount = data.PageCount;

        var isSubscribed = await client.Cypher
            .Match("(u:User)-[r:SUBSCRIBED_TO]->(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Return(r => r.As<object>())
            .ResultsAsync;

        data.Wiki.IsSubscribed = isSubscribed.Any();

        data.Wiki.OnlineUserCount = (int)_redis.GetOnlineCount(wikiId);

        _redis.IncrementWikiView(wikiId);

        return Ok(data.Wiki);
    }

    [HttpGet("my")]
    public async Task<ActionResult> GetMyWikis()
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var results = await client.Cypher
            .Match("(u:User)-[:SUBSCRIBED_TO]->(w:Wiki)")
            .Where((User u) => u.Id == userId)
            .Match("(owner:User)-[:OWNS]->(w)")
            .OptionalMatch("(subscriber:User)-[:SUBSCRIBED_TO]->(w)")
            .OptionalMatch("(p:WikiPage)-[:BELONGS_TO]->(w)")
            .With("w, owner, u, COUNT(DISTINCT subscriber) AS subCount, COUNT(DISTINCT p) AS pageCount, EXISTS((u)-[:OWNS]->(w)) AS isOwner")
            .Return((w, owner, subCount, pageCount, isOwner) => new
            {
                Wiki = w.As<Wiki>(),
                OwnerUsername = owner.As<User>().Username,
                SubCount = subCount.As<int>(),
                PageCount = pageCount.As<int>(),
                IsOwner = isOwner.As<bool>()
            })
            .OrderBy("w.createdAt DESC")
            .ResultsAsync;

        var wikis = results.Select(r =>
        {
            r.Wiki.OwnerUsername = r.OwnerUsername;
            r.Wiki.SubscriberCount = r.SubCount;
            r.Wiki.PageCount = r.PageCount;
            r.Wiki.IsOwner = r.IsOwner;
            return r.Wiki;
        }).ToList();

        return Ok(wikis);
    }

    [HttpPost("{wikiId}/subscribe")]
    public async Task<ActionResult> Subscribe(string wikiId)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var wikiExists = await client.Cypher
            .Match("(w:Wiki)")
            .Where((Wiki w) => w.Id == wikiId)
            .Return(w => w.As<Wiki>())
            .ResultsAsync;

        if (!wikiExists.Any())
            return NotFound(new { message = "Wiki not found" });

        await client.Cypher
            .Match("(u:User)", "(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Merge("(u)-[:SUBSCRIBED_TO]->(w)")
            .ExecuteWithoutResultsAsync();

        return Ok(new { message = "Subscribed successfully" });
    }

    [HttpDelete("{wikiId}/unsubscribe")]
public async Task<ActionResult> Unsubscribe(string wikiId)
{
    var userId = GetUserId();
    var client = await _neo4j.GetClientAsync();

    var isOwner = await client.Cypher
        .Match("(u:User)-[:OWNS]->(w:Wiki)")
        .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
        .Return(u => u.As<User>())
        .ResultsAsync;

    if (isOwner.Any())
        return BadRequest(new { message = "Wiki owners cannot unsubscribe from their own wikis" });

    await client.Cypher
        .Match("(u:User)-[r:SUBSCRIBED_TO]->(w:Wiki)")
        .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
        .Delete("r")
        .ExecuteWithoutResultsAsync();

    return Ok(new { message = "Unsubscribed successfully" });
}

    [HttpGet("search")]
    public async Task<ActionResult> SearchWikis([FromQuery] string query)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();
        string searchPattern = ".*" + query + ".*";

        var results = await client.Cypher
        .Match("(w:Wiki)", "(owner:User)-[:OWNS]->(w)")
        .Where("w.IsPrivate = false AND (w.Name =~ $pattern OR w.Description =~ $pattern)")
        .WithParam("pattern", searchPattern)
        .OptionalMatch("(subscriber:User)-[:SUBSCRIBED_TO]->(w)")
        .OptionalMatch("(currentUser:User {Id: $userId})-[sub:SUBSCRIBED_TO]->(w)")
        .WithParam("userId", userId)
        .With("w, owner, COUNT(DISTINCT subscriber) as subCount, (sub IS NOT NULL) as isSubscribed")
        .Return((w, owner, subCount, isSubscribed) => new
        {
            Wiki = w.As<Wiki>(),
            OwnerUsername = owner.As<User>().Username,
            SubCount = subCount.As<int>(),
            IsSubscribed = isSubscribed.As<bool>()
        })
        .Limit(20)
        .ResultsAsync;

        var wikis = results.Select(r =>
        {
            r.Wiki.OwnerUsername = r.OwnerUsername;
            r.Wiki.SubscriberCount = r.SubCount;
            r.Wiki.IsSubscribed = r.IsSubscribed;
            return r.Wiki;
        }).ToList();

        return Ok(wikis);
    }

    [HttpGet("public")]
    public async Task<ActionResult> GetPublicWikis()
    {
        var client = await _neo4j.GetClientAsync();

        var results = await client.Cypher
            .Match("(w:Wiki)")
            .Where((Wiki w) => w.IsPrivate == false)
            .Match("(owner:User)-[:OWNS]->(w)")
            .Return((w, owner) => new
            {
                Wiki = w.As<Wiki>(),
                OwnerUsername = owner.As<User>().Username
            })
            .ResultsAsync;

        var wikis = results.Select(r =>
        {
            r.Wiki.OwnerUsername = r.OwnerUsername;
            return r.Wiki;
        }).ToList();

        return Ok(new { count = wikis.Count, wikis });
    }

    [HttpGet("trending")]
    public async Task<ActionResult> GetTrendingWikis([FromQuery] int count = 10)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var trendingIds = _redis.GetTrendingWikis(count);

        if (trendingIds.Count == 0)
            return Ok(new { count = 0, wikis = new List<object>() });

        var results = await client.Cypher
        .Match("(w:Wiki)", "(owner:User)-[:OWNS]->(w)")
        .Where("w.Id IN $ids AND w.IsPrivate = false")
        .WithParam("ids", trendingIds)
        .OptionalMatch("(subscriber:User)-[:SUBSCRIBED_TO]->(w)")
        .OptionalMatch("(currentUser:User {Id: $userId})-[sub:SUBSCRIBED_TO]->(w)")
        .WithParam("userId", userId)
        .With("w, owner, COUNT(DISTINCT subscriber) as subCount, (sub IS NOT NULL) as isSubscribed")
        .Return((w, owner, subCount, isSubscribed) => new
        {
            Wiki = w.As<Wiki>(),
            OwnerUsername = owner.As<User>().Username,
            SubCount = subCount.As<int>(),
            IsSubscribed = isSubscribed.As<bool>()
        })
        .ResultsAsync;

        var wikisDict = results.ToDictionary(r => r.Wiki.Id!);
        var wikis = trendingIds
            .Where(id => wikisDict.ContainsKey(id))
            .Select(id =>
            {
                var r = wikisDict[id];
                r.Wiki.OwnerUsername = r.OwnerUsername;
                r.Wiki.SubscriberCount = r.SubCount;
                r.Wiki.IsSubscribed = r.IsSubscribed;
                return r.Wiki;
            })
            .ToList();

        return Ok(new { count = wikis.Count, wikis });
    }

    [HttpGet("stats/most-viewed")]
    public async Task<ActionResult> GetMostViewedWikis([FromQuery] int count = 10)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var results = await client.Cypher
        .Match("(w:Wiki)", "(owner:User)-[:OWNS]->(w)")
        .Where((Wiki w) => w.IsPrivate == false)
        .OptionalMatch("(subscriber:User)-[:SUBSCRIBED_TO]->(w)")
        .OptionalMatch("(currentUser:User {Id: $userId})-[sub:SUBSCRIBED_TO]->(w)")
        .WithParam("userId", userId)
        .With("w, owner, COUNT(DISTINCT subscriber) as subCount, (sub IS NOT NULL) as isSubscribed")
        .OrderByDescending("subCount")
        .Limit(count)
        .Return((w, owner, subCount, isSubscribed) => new
        {
            Wiki = w.As<Wiki>(),
            OwnerUsername = owner.As<User>().Username,
            SubCount = subCount.As<int>(),
            IsSubscribed = isSubscribed.As<bool>()
        })
        .ResultsAsync;

        var wikis = results.Select(r =>
        {
            r.Wiki.OwnerUsername = r.OwnerUsername;
            r.Wiki.SubscriberCount = r.SubCount;
            r.Wiki.IsSubscribed = r.IsSubscribed;
            return r.Wiki;
        }).ToList();

        return Ok(new { count = wikis.Count, wikis });
    }
}