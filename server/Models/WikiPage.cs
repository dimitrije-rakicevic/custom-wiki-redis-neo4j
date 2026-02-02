namespace CustomWiki.Models;

public class WikiPage
{
    public string? Id { get; set; }
    public string? WikiId { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}