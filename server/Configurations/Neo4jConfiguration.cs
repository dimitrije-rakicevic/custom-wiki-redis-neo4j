namespace CustomWiki.Configurations
{
    public class Neo4jConfiguration
    {
        public string? Uri { get; set; }
        public string? Username { get; set; }
        public string? Password { get; set; }
        
        public Neo4jConfiguration()
        {
            Uri = Environment.GetEnvironmentVariable("NEO4J_URI");
            Username = Environment.GetEnvironmentVariable("NEO4J_USERNAME");
            Password = Environment.GetEnvironmentVariable("NEO4J_PASSWORD");
        }
        
        public void Validate()
        {
            if (string.IsNullOrWhiteSpace(Uri))
                throw new InvalidOperationException("Neo4j URI is required");
        
            if (string.IsNullOrWhiteSpace(Username))
                throw new InvalidOperationException("Neo4j Username is required");
        
            if (string.IsNullOrWhiteSpace(Password))
                throw new InvalidOperationException("Neo4j Password is required");
        } 
        
    }
}