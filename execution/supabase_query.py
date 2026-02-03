import os
import json
import argparse
from dotenv import load_dotenv
from supabase import create_client, Client

def main():
    parser = argparse.ArgumentParser(description="Deterministic Supabase Query Executor")
    parser.add_argument("--query", type=str, help="SQL query to execute (raw SQL)")
    parser.add_argument("--table", type=str, help="Table name for basic operations")
    parser.add_argument("--select", type=str, default="*", help="Columns to select")
    parser.add_argument("--test-connection", action="store_true", help="Test connection to Supabase")
    parser.add_argument("--env-path", type=str, default="krishi-ai-backend/.env", help="Path to .env file")
    
    args = parser.parse_args()

    # Load environment variables
    load_dotenv(args.env_path)
    
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print(json.dumps({"status": "error", "message": "Missing SUPABASE_URL or SUPABASE_KEY in environment"}))
        return

    try:
        # Prefer service key for backend operations if available
        client: Client = create_client(url, service_key if service_key else key)

        if args.test_connection:
            # Simple test to verify connection
            try:
                # We use a known table from the schema if possible, otherwise just a heartbeat
                # Let's try listing tables or just a simple query if we know one exists
                response = client.table("market_prices").select("count", count="exact").limit(1).execute()
                print(json.dumps({"status": "success", "message": "Connected to Supabase", "count": response.count}))
            except Exception as e:
                print(json.dumps({"status": "error", "message": f"Connection test failed: {str(e)}"}))
            return

        if args.query:
            # The supabase-py library doesn't support raw SQL directly in the client easily without rpc
            # For raw SQL, users usually use the REST API or rpc functions.
            # However, we can use the postgrest client if we want to bypass some abstractions.
            # For this execution script, we'll implement basic table operations and rpc if needed.
            # If the user really needs raw SQL, we might need a different approach or an rpc function.
            print(json.dumps({"status": "error", "message": "Raw SQL not directly supported via client. Use table operations or RPC."}))
            return

        if args.table:
            query = client.table(args.table).select(args.select)
            response = query.execute()
            print(json.dumps({"status": "success", "data": response.data}))
        else:
            print(json.dumps({"status": "error", "message": "No operation specified. Use --table or --test-connection."}))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))

if __name__ == "__main__":
    main()
