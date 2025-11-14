# Database Schema Documentation

This document explains the complete database architecture for AI City, a real-time chat application with AI bot integration.

---

## Overview

The database is built on **Supabase (PostgreSQL)** and supports:
- Real-time messaging between humans and AI bots
- Direct messages (DMs) and group chats
- Secure data access with Row Level Security (RLS)
- Message persistence and chat history

---

## Database Schema

### 1. `users` Table (Existing - Modified)

Stores all user accounts (both humans and AI bots).

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (matches `auth.users.id`) |
| `email` | text | User email address |
| `name` | text | Display name |
| `profile_picture` | text | Avatar URL (nullable) |
| `is_bot` | boolean | `true` for AI bots, `false` for humans |
| `created_at` | timestamptz | Account creation timestamp |

**Key Points:**
- Synced with Supabase Auth (`auth.users`) - same UUID
- `is_bot` flag distinguishes AI participants from humans
- Human users created via Google OAuth
- Bot users created programmatically

**SQL:**
```sql
ALTER TABLE public.users
ADD COLUMN is_bot boolean DEFAULT false;
```

---

### 2. `channels` Table

Represents both DMs and group chats.

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Channel name (nullable) |
| `is_group` | boolean | `false` for DMs, `true` for groups |
| `created_by` | uuid | Foreign key → `users.id` |
| `created_at` | timestamptz | Channel creation timestamp |

**Design Pattern:**
- **DMs:** `is_group = false`, `name = null`, exactly 2 members
- **Groups:** `is_group = true`, `name = 'Group Name'`, 2+ members

**Foreign Keys:**
- `created_by` → `users(id)` with `ON DELETE SET NULL`
  - If creator is deleted, channel remains but creator becomes null

**SQL:**
```sql
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  is_group boolean DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
```

---

### 3. `channel_members` Table (Junction Table)

Many-to-many relationship between users and channels.

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `channel_id` | uuid | Foreign key → `channels.id` |
| `user_id` | uuid | Foreign key → `users.id` |
| `joined_at` | timestamptz | Membership timestamp |

**Constraints:**
- `UNIQUE(channel_id, user_id)` - Prevents duplicate memberships

**Foreign Keys:**
- `channel_id` → `channels(id)` with `ON DELETE CASCADE`
  - If channel is deleted, remove all memberships
- `user_id` → `users(id)` with `ON DELETE CASCADE`
  - If user is deleted, remove their memberships

**Why a Junction Table?**
Instead of storing member IDs as an array in `channels`, we use a separate table for:
1. **Performance:** Fast indexed queries
2. **Scalability:** Handles millions of members efficiently
3. **Flexibility:** Can add metadata (roles, permissions, etc.)
4. **Real-time:** Easy to subscribe to membership changes
5. **Safety:** No race conditions with concurrent joins

**SQL:**
```sql
CREATE TABLE public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);
```

---

### 4. `messages` Table

Stores all chat messages.

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `channel_id` | uuid | Foreign key → `channels.id` |
| `sender_id` | uuid | Foreign key → `users.id` |
| `content` | text | Message text (required) |
| `created_at` | timestamptz | Message timestamp |

**Foreign Keys:**
- `channel_id` → `channels(id)` with `ON DELETE CASCADE`
  - If channel is deleted, delete all messages
- `sender_id` → `users(id)` with `ON DELETE CASCADE`
  - If user is deleted, delete their messages

**SQL:**
```sql
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

---

## Performance Indexes

Indexes speed up common queries:

```sql
-- Find all members of a channel (fast)
CREATE INDEX idx_channel_members_channel ON public.channel_members(channel_id);

-- Find all channels a user is in (fast)
CREATE INDEX idx_channel_members_user ON public.channel_members(user_id);

-- Find all messages in a channel (fast)
CREATE INDEX idx_messages_channel ON public.messages(channel_id);

-- Sort messages by time (fast)
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);
```

---

## Row Level Security (RLS)

RLS ensures users can only access data they're authorized to see.

### Enable RLS:
```sql
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
```

### Channels Policies:

**1. View channels you're a member of:**
```sql
CREATE POLICY "Users can view channels they're members of"
ON public.channels FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_members.channel_id = channels.id
    AND channel_members.user_id = auth.uid()
  )
);
```

**2. Create channels:**
```sql
CREATE POLICY "Users can create channels"
ON public.channels FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);
```

### Channel Members Policies:

**1. View members of your channels:**
```sql
CREATE POLICY "Users can view members of their channels"
ON public.channel_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channel_members AS cm
    WHERE cm.channel_id = channel_members.channel_id
    AND cm.user_id = auth.uid()
  )
);
```

**2. Add members (channel creators only):**
```sql
CREATE POLICY "Channel creators can add members"
ON public.channel_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.channels
    WHERE channels.id = channel_members.channel_id
    AND channels.created_by = auth.uid()
  )
);
```

### Messages Policies:

**1. View messages in your channels:**
```sql
CREATE POLICY "Users can view messages in their channels"
ON public.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_members.channel_id = messages.channel_id
    AND channel_members.user_id = auth.uid()
  )
);
```

**2. Send messages to your channels:**
```sql
CREATE POLICY "Users can send messages to their channels"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE channel_members.channel_id = messages.channel_id
    AND channel_members.user_id = auth.uid()
  )
);
```

---

## Real-time Subscriptions

Enable real-time updates for instant messaging:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_members;
```

**What this enables:**
- New messages appear instantly without page refresh
- See when users join/leave channels in real-time
- Powers the live chat experience

---

## Data Relationships

```
┌─────────────┐
│    users    │  (existing table with is_bot added)
└──────┬──────┘
       │
       ├──────────┐
       │          │
       ↓          ↓
┌─────────────┐  ┌──────────────────┐
│  channels   │  │ channel_members  │  (junction table)
└──────┬──────┘  └────────┬─────────┘
       │                  │
       │                  │
       ↓                  ↓
┌─────────────┐          (many-to-many relationship)
│  messages   │
└─────────────┘
```

**Relationships:**
- Users ↔ Channels (many-to-many via `channel_members`)
- Channels → Messages (one-to-many)
- Users → Messages (one-to-many)

---

## Example Queries

### Create a DM between two users:
```sql
-- 1. Create channel
INSERT INTO channels (is_group, name, created_by)
VALUES (false, null, 'user1-uuid')
RETURNING id;

-- 2. Add both users as members
INSERT INTO channel_members (channel_id, user_id)
VALUES
  ('channel-uuid', 'user1-uuid'),
  ('channel-uuid', 'user2-uuid');
```

### Create a group chat:
```sql
-- 1. Create channel
INSERT INTO channels (is_group, name, created_by)
VALUES (true, 'AI Enthusiasts', 'user1-uuid')
RETURNING id;

-- 2. Add members (including a bot)
INSERT INTO channel_members (channel_id, user_id)
VALUES
  ('channel-uuid', 'user1-uuid'),
  ('channel-uuid', 'user2-uuid'),
  ('channel-uuid', 'bot-uuid');
```

### Send a message:
```sql
INSERT INTO messages (channel_id, sender_id, content)
VALUES ('channel-uuid', 'user-uuid', 'Hello, world!');
```

### Get all channels for a user:
```sql
SELECT channels.*
FROM channels
JOIN channel_members ON channels.id = channel_members.channel_id
WHERE channel_members.user_id = 'user-uuid'
ORDER BY channels.created_at DESC;
```

### Get all messages in a channel:
```sql
SELECT messages.*, users.name, users.profile_picture
FROM messages
JOIN users ON messages.sender_id = users.id
WHERE messages.channel_id = 'channel-uuid'
ORDER BY messages.created_at ASC;
```

---

## Setup Instructions

Run these SQL commands in order in your Supabase SQL Editor:

1. Add `is_bot` column to users
2. Create `channels` table
3. Create `channel_members` table
4. Create `messages` table
5. Create performance indexes
6. Enable RLS on all tables
7. Create RLS policies
8. Enable real-time subscriptions

All SQL commands are provided in the sections above.

---

## Notes

- **UUIDs are auto-generated** using `gen_random_uuid()`
- **Timestamps default to `now()`** automatically
- **Cascade deletes** keep data consistent (no orphaned records)
- **RLS policies** are enforced at the database level (can't be bypassed)
- **Real-time** works via Supabase's WebSocket connections

---

This schema supports the core requirements:
✅ Real-time messaging
✅ DMs and group chats
✅ AI bot integration
✅ Message persistence
✅ Secure data access
