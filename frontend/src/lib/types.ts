export type ItemType = "note" | "link" | "snippet";
export type ItemState = "inbox" | "active" | "archive";

export interface Tag {
  id: string;
  name: string;
}

export interface ItemTag {
  tag_id: string;
  tags: Tag;
}

export interface Item {
  id: string;
  user_id: string;
  type: ItemType;
  title: string | null;
  content: string | null;
  url: string | null;
  state: ItemState;
  why_this_matters: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  item_tags?: ItemTag[];
}

export interface TagWithCount {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  item_count: number;
}
