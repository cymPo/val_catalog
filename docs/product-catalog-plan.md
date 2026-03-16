# Product Catalog Plan

## Goal

Build a purchasing catalog that supports:

1. Products with dynamic category depth
2. Products with variants and attributes
3. Unlimited category levels
4. User-defined product groups
5. A catalog picker that shows either product groups or the deepest category level, not every product immediately

## Recommended Modeling Approach

Use a hybrid relational model:

- Relational tables for core entities and joins
- A category tree with parent-child links
- JSONB only for flexible attribute values, not for the primary structure

This keeps the catalog dynamic without losing queryability.

## Core Entities

### 1. Categories

Categories should be stored as a tree, not as fixed columns like `category_level_1`, `category_level_2`, etc.

Recommended fields:

- `id`
- `tenant_id`
- `parent_id` nullable
- `name`
- `slug`
- `path`
- `depth`
- `is_leaf`
- `sort_order`
- `is_active`
- `created_at`
- `updated_at`

Notes:

- `parent_id` makes the hierarchy dynamic
- `path` stores a stable full path such as `/electrical/wire/copper`
- `depth` makes filtering and display easier
- `is_leaf` allows fast lookup of deepest categories

### 2. Products

The product is the buyable template, not the specific SKU variation.

Recommended fields:

- `id`
- `tenant_id`
- `category_id`
- `name`
- `slug`
- `description`
- `brand`
- `status`
- `default_uom`
- `is_active`
- `created_at`
- `updated_at`

Notes:

- `category_id` should point to the assigned deepest category
- If a product must appear in multiple categories later, add a join table instead of changing the category model

### 3. Product Variants

Variants represent purchasable SKUs.

Recommended fields:

- `id`
- `tenant_id`
- `product_id`
- `sku`
- `name`
- `barcode`
- `status`
- `price`
- `currency_code`
- `pack_size`
- `uom`
- `is_default`
- `is_active`
- `created_at`
- `updated_at`

Examples:

- Paint product -> variants for `1 gal`, `5 gal`
- T-shirt product -> variants for `size` and `color`

### 4. Attributes

Separate attribute definitions from attribute values.

#### Attribute Definitions

- `id`
- `tenant_id`
- `name`
- `code`
- `scope` (`product`, `variant`, `both`)
- `data_type` (`text`, `number`, `boolean`, `select`, `multi_select`)
- `is_filterable`
- `is_required`
- `sort_order`

#### Attribute Options

Used when `data_type` is `select` or `multi_select`.

- `id`
- `attribute_id`
- `label`
- `value`
- `sort_order`

#### Product Attribute Values

- `id`
- `product_id`
- `attribute_id`
- `value_jsonb`

#### Variant Attribute Values

- `id`
- `variant_id`
- `attribute_id`
- `value_jsonb`

Why this structure:

- Definitions stay reusable
- Values stay dynamic
- Filtering remains possible
- You avoid adding columns every time the business invents a new property

### 5. Product Groups

Product groups are user-defined saved collections.

Recommended fields:

- `id`
- `tenant_id`
- `owner_user_id`
- `name`
- `description`
- `visibility` (`private`, `shared`, `public_within_tenant`)
- `sort_order`
- `created_at`
- `updated_at`

#### Product Group Items

- `id`
- `group_id`
- `item_type` (`product`, `variant`)
- `item_id`
- `sort_order`

Recommendation:

- Start with manual groups
- Later you can add smart groups with rules like `category = wire` and `brand = southwire`

### 6. Optional Mapping Tables

Add these only if needed:

#### Product Category Map

Allows one product in multiple categories.

- `product_id`
- `category_id`

#### Catalog Visibility Rules

Allows role-based or company-based visibility.

- `id`
- `tenant_id`
- `entity_type`
- `entity_id`
- `viewer_type`
- `viewer_id`

## Catalog Browsing Rule

Your requirement is:

- do not show every product immediately
- show either product groups or deepest category level

Recommended behavior:

### Entry Screen

Show two node types:

- Product groups available to the user
- Top-level categories

### When a user opens a category

Keep drilling down category children until there are no more child categories.

### When a category has no child categories

Show:

- deepest category node summary
- product cards inside that leaf category

This means products are only shown at the leaf category level.

### When a user opens a product group

Show the products or variants inside that group directly.

## Display Model

For the catalog UI, treat the picker as a list of `catalog nodes`.

Recommended response shape:

```ts
type CatalogNode =
  | {
      type: "group";
      id: string;
      name: string;
      itemCount: number;
    }
  | {
      type: "category";
      id: string;
      name: string;
      depth: number;
      hasChildren: boolean;
      productCount: number;
    }
  | {
      type: "product";
      id: string;
      name: string;
      variantCount: number;
    };
```

UI rule:

- root level returns `group` and top-level `category`
- intermediate category level returns child `category`
- leaf category level returns `product`
- product group level returns `product` or `variant`

## Important Constraints

### Do not hardcode category levels

Avoid tables or forms with:

- `department`
- `category`
- `subcategory`
- `subsubcategory`

That will break once one branch has 2 levels and another has 6.

### Do not put all product data in one JSON blob

That makes filtering, joins, reporting, and validation harder.

### Keep tenant separation from day one

Since users can create their own groups and likely manage their own catalog data, every business table should include `tenant_id`.

## Suggested Supabase/Postgres Implementation

Recommended first tables:

1. `catalog_categories`
2. `catalog_products`
3. `catalog_product_variants`
4. `catalog_attribute_definitions`
5. `catalog_attribute_options`
6. `catalog_product_attribute_values`
7. `catalog_variant_attribute_values`
8. `catalog_product_groups`
9. `catalog_product_group_items`

Recommended indexes:

- categories: `(tenant_id, parent_id)`
- categories: `(tenant_id, path)`
- products: `(tenant_id, category_id)`
- variants: `(tenant_id, product_id)`
- group items: `(group_id, item_type, item_id)`

## Recommended Build Order

### Phase 1

- category tree
- products
- variants
- basic catalog browsing to leaf categories

### Phase 2

- attribute definitions and values
- product filtering
- search

### Phase 3

- user-created product groups
- shared/private visibility
- purchasing shortcuts from groups

### Phase 4

- smart groups
- approval-aware visibility
- price history, preferred vendors, contract catalogs

## Practical Recommendation

If this app is for purchasing, the most stable first version is:

- one product belongs to one leaf category
- product has many variants
- attributes are definition-based
- product groups are user-owned saved collections
- catalog browsing shows categories until leaf, then products

That design is dynamic enough for your requirements without overcomplicating the first release.
