using Neo4j.Driver;
namespace CustomWiki.Models;

public class Wiki
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public bool IsPrivate { get; set; }
    public DateTime CreatedAt { get; set; }
    
    public string? OwnerUsername { get; set; }
    public int SubscriberCount { get; set; }
    public int PageCount { get; set; }
    public bool IsSubscribed { get; set; }
    public int OnlineUserCount { get; set; }
    public bool IsOwner { get; set; }
}