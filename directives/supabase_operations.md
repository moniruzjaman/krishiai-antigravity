# Supabase Operations Directive

## Goal

Provide a reliable and deterministic way to interact with the Supabase database using the project's 3-Layer Architecture.

## Inputs

- **SQL Query**: A valid PostgreSQL query string.
- **Operation Type**: (Optional) `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
- **Table Name**: (Optional) The target table for the operation.
- **Parameters**: (Optional) JSON object containing data for inserts/updates or filters.

## Tools

- `execution/supabase_query.py`: The deterministic script that interacts with Supabase.

## Expected Output

- A JSON object containing:
  - `status`: `success` or `error`.
  - `data`: The result of the query (list of objects).
  - `message`: (Optional) Success or error message.

## Edge Cases & Error Handling

- **Invalid SQL**: Return a descriptive error message from the database.
- **Missing Credentials**: Ensure `.env` contains `SUPABASE_URL` and `SUPABASE_KEY`.
- **Network Issues**: Handle connection timeouts and retries in the execution script.

## Usage Example

1. Identify the need for a database operation (e.g., fetching market prices).
2. Call `execution/supabase_query.py` with the appropriate query.
3. Use the returned JSON data for business logic.
