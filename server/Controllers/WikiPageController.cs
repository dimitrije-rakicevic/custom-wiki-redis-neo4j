using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using CustomWiki.Models;
using CustomWiki.Services;
using CustomWiki.DTOs;

namespace CustomWiki.Controllers;

[ApiController]
[Route("api/wiki/{wikiId}/pages")]
[Authorize]
public class WikiPageController : ControllerBase
{
    private readonly Neo4jService _neo4j;

    public WikiPageController(Neo4jService neo4j)
    {
        _neo4j = neo4j;
    }

    private string GetUserId() => User.FindFirst("UserId")?.Value ?? "";

    [HttpPost]
    public async Task<ActionResult> CreatePage(string wikiId, [FromBody] CreatePageRequest request)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var ownsWiki = await client.Cypher
            .Match("(u:User)-[:OWNS]->(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Return(w => w.As<Wiki>())
            .ResultsAsync;

        if (!ownsWiki.Any())
            return Forbid();

        var page = new WikiPage
        {
            Id = Guid.NewGuid().ToString(),
            WikiId = wikiId,
            Title = request.Title,
            Content = request.Content,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await client.Cypher
            .Match("(creator:User)", "(w:Wiki)")
            .Where((User creator, Wiki w) => creator.Id == userId && w.Id == wikiId)
            .Create("(p:WikiPage $page)")
            .WithParam("page", page)
            .Create("(creator)-[:CREATED]->(p)")
            .Create("(p)-[:BELONGS_TO]->(w)")
            .ExecuteWithoutResultsAsync();

        return Ok(page);
    }

    [HttpGet]
    public async Task<ActionResult> GetPages(string wikiId)
    {
        var client = await _neo4j.GetClientAsync();

        var pages = await client.Cypher
            .Match("(p:WikiPage)-[:BELONGS_TO]->(w:Wiki)")
            .Where((Wiki w) => w.Id == wikiId)
            .Return(p => p.As<WikiPage>())
            .OrderBy("p.createdAt")
            .ResultsAsync;

        return Ok(pages);
    }

    [HttpGet("{pageId}")]
    public async Task<ActionResult> GetPage(string wikiId, string pageId)
    {
        var client = await _neo4j.GetClientAsync();

        var results = await client.Cypher
            .Match("(p:WikiPage)-[:BELONGS_TO]->(w:Wiki)")
            .Where((WikiPage p, Wiki w) => p.Id == pageId && w.Id == wikiId)
            .Return(p => p.As<WikiPage>())
            .ResultsAsync;

        var page = results.FirstOrDefault();
        if (page == null)
            return NotFound(new { message = "Page not found" });

        return Ok(page);
    }

    [HttpPut("{pageId}")]
    public async Task<ActionResult> UpdatePage(string wikiId, string pageId, [FromBody] UpdatePageRequest request)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var ownsWiki = await client.Cypher
            .Match("(u:User)-[:OWNS]->(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Return(w => w.As<Wiki>())
            .ResultsAsync;

        if (!ownsWiki.Any())
            return Forbid();

        var pages = await client.Cypher
            .Match("(p:WikiPage)-[:BELONGS_TO]->(w:Wiki)")
            .Where((WikiPage p, Wiki w) => p.Id == pageId && w.Id == wikiId)
            .Set("p.Title = $title")
            .Set("p.Content = $content")
            .Set("p.UpdatedAt = $updatedAt")
            .WithParams(new
            {
                title = request.Title,
                content = request.Content,
                updatedAt = DateTime.UtcNow
            })
            .Return(p => p.As<WikiPage>())
            .ResultsAsync;

        var page = pages.FirstOrDefault();
        if (page == null)
            return NotFound(new { message = "Page not found" });

        return Ok(page);
    }

    [HttpDelete("{pageId}")]
    public async Task<ActionResult> DeletePage(string wikiId, string pageId)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var ownsWiki = await client.Cypher
            .Match("(u:User)-[:OWNS]->(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Return(w => w.As<Wiki>())
            .ResultsAsync;

        if (!ownsWiki.Any())
            return Forbid();

        await client.Cypher
            .Match("(p:WikiPage)-[:BELONGS_TO]->(w:Wiki)")
            .Where((WikiPage p, Wiki w) => p.Id == pageId && w.Id == wikiId)
            .DetachDelete("p")
            .ExecuteWithoutResultsAsync();

        return Ok(new { message = "Page deleted successfully" });
    }
    [HttpPost("relationships")]
    public async Task<ActionResult> CreateRelationship(string wikiId, [FromBody] CreateRelationshipRequest request)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var ownsWiki = await client.Cypher
            .Match("(u:User)-[:OWNS]->(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Return(w => w.As<Wiki>())
            .ResultsAsync;

        if (!ownsWiki.Any())
            return Forbid();
        
        var pages = await client.Cypher
            .Match("(p:WikiPage)-[:BELONGS_TO]->(w:Wiki)")
            .Where((Wiki w) => w.Id == wikiId)
            .AndWhere((WikiPage p) => p.Id == request.FromPageId || p.Id == request.ToPageId)
            .WithParams(new { fromId = request.FromPageId, toId = request.ToPageId })
            .Return(p => p.As<WikiPage>())
            .ResultsAsync;

        if (pages.Count() != 2)
            return BadRequest(new { message = "One or both pages not found in this wiki" });

        string relName = request.RelationType == RelationshipTypes.Custom && !string.IsNullOrEmpty(request.CustomLabel)
            ? request.CustomLabel.ToUpper().Replace(" ", "_")
            : request.RelationType.ToUpper();

        await client.Cypher
            .Match("(from:WikiPage)", "(to:WikiPage)")
            .Where((WikiPage from, WikiPage to) => from.Id == request.FromPageId && to.Id == request.ToPageId)
            .Create($"(from)-[r:{relName} {{createdAt: datetime(), createdBy: $userId, type: $type}}]->(to)")
            .WithParams(new { 
                userId, 
                type = request.RelationType 
            })
            .ExecuteWithoutResultsAsync();

        if (request.IsBidirectional)
        {
            await client.Cypher
                .Match("(from:WikiPage)", "(to:WikiPage)")
                .Where((WikiPage from, WikiPage to) => from.Id == request.ToPageId && to.Id == request.FromPageId)
                .Create($"(from)-[r:{relName} {{createdAt: datetime(), createdBy: $userId, type: $type}}]->(to)")
                .WithParams(new { 
                    userId, 
                    type = request.RelationType 
                })
                .ExecuteWithoutResultsAsync();
        }

        return Ok(new { 
            message = "Relationship created", 
            relationshipType = relName,
            isBidirectional = request.IsBidirectional
        });
    }

    [HttpGet("{pageId}/relationships")]
    public async Task<ActionResult> GetPageRelationships(string wikiId, string pageId)
    {
        var client = await _neo4j.GetClientAsync();

        var outgoing = await client.Cypher
            .Match("(from:WikiPage)-[r]->(to:WikiPage)")
            .Where((WikiPage from) => from.Id == pageId)
            .Return((from, r, to) => new
            {
                RelationType = r.Type(),
                FromPageId = from.As<WikiPage>().Id,
                FromPageTitle = from.As<WikiPage>().Title,
                ToPageId = to.As<WikiPage>().Id,
                ToPageTitle = to.As<WikiPage>().Title
            })
            .ResultsAsync;

        var incoming = await client.Cypher
            .Match("(from:WikiPage)-[r]->(to:WikiPage)")
            .Where((WikiPage to) => to.Id == pageId)
            .Return((from, r, to) => new
            {
                RelationType = r.Type(),
                FromPageId = from.As<WikiPage>().Id,
                FromPageTitle = from.As<WikiPage>().Title,
                ToPageId = to.As<WikiPage>().Id,
                ToPageTitle = to.As<WikiPage>().Title
            })
            .ResultsAsync;

        return Ok(new
        {
            pageId,
            outgoing = outgoing.ToList(),
            incoming = incoming.ToList()
        });
    }

    [HttpDelete("relationships")]
    public async Task<ActionResult> DeleteRelationship(
        string wikiId, 
        [FromQuery] string fromPageId, 
        [FromQuery] string toPageId,
        [FromQuery] string relationType)
    {
        var userId = GetUserId();
        var client = await _neo4j.GetClientAsync();

        var ownsWiki = await client.Cypher
            .Match("(u:User)-[:OWNS]->(w:Wiki)")
            .Where((User u, Wiki w) => u.Id == userId && w.Id == wikiId)
            .Return(w => w.As<Wiki>())
            .ResultsAsync;

        if (!ownsWiki.Any())
            return Forbid();

        string relName = relationType.ToUpper().Replace(" ", "_");
        
        await client.Cypher
            .Match($"(from:WikiPage)-[r:{relName}]->(to:WikiPage)")
            .Where("from.Id = $fromId AND to.Id = $toId")
            .WithParams(new { fromId = fromPageId, toId = toPageId })
            .Delete("r")
            .ExecuteWithoutResultsAsync();

        return Ok(new { message = "Relationship deleted" });
    }

    [HttpGet("{pageId}/related")]
    public async Task<ActionResult> GetRelatedPages(string wikiId, string pageId, [FromQuery] int depth = 2)
    {
        var client = await _neo4j.GetClientAsync();

        var related = await client.Cypher
            .Match($"(page:WikiPage)-[*1..{depth}]-(related:WikiPage)")
            .Where((WikiPage page) => page.Id == pageId)
            .AndWhere("page.id <> related.id")
            .Return(related => new
            {
                Page = related.As<WikiPage>(),
                Distance = related.Count()
            })
            .Limit(10)
            .ResultsAsync;

        return Ok(new
        {
            pageId,
            depth,
            relatedPages = related.ToList()
        });
    }
}
