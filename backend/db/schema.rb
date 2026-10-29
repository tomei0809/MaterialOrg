# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_10_29_164010) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "bundles", force: :cascade do |t|
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["user_id"], name: "index_bundles_on_user_id"
  end

  create_table "folders", force: :cascade do |t|
    t.string "name", null: false
    t.string "color", default: "blue", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "parent_id"
    t.integer "position", default: 0, null: false
    t.bigint "user_id"
    t.index ["parent_id"], name: "index_folders_on_parent_id"
    t.index ["user_id", "parent_id", "name"], name: "index_folders_on_user_id_and_parent_id_and_name", unique: true, nulls_not_distinct: true
    t.index ["user_id"], name: "index_folders_on_user_id"
  end

  create_table "material_tags", force: :cascade do |t|
    t.bigint "material_id", null: false
    t.bigint "tag_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["material_id", "tag_id"], name: "index_material_tags_on_material_id_and_tag_id", unique: true
    t.index ["material_id"], name: "index_material_tags_on_material_id"
    t.index ["tag_id"], name: "index_material_tags_on_tag_id"
  end

  create_table "materials", force: :cascade do |t|
    t.string "title"
    t.string "material_type"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "folder_id"
    t.bigint "bundle_id"
    t.integer "bundle_position"
    t.datetime "favorited_at"
    t.datetime "last_opened_at"
    t.datetime "deleted_at"
    t.bigint "user_id"
    t.index ["bundle_id"], name: "index_materials_on_bundle_id"
    t.index ["deleted_at"], name: "index_materials_on_deleted_at"
    t.index ["favorited_at"], name: "index_materials_on_favorited_at"
    t.index ["folder_id"], name: "index_materials_on_folder_id"
    t.index ["last_opened_at"], name: "index_materials_on_last_opened_at"
    t.index ["user_id"], name: "index_materials_on_user_id"
  end

  create_table "sessions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "tags", force: :cascade do |t|
    t.string "name", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["user_id", "name"], name: "index_tags_on_user_id_and_name", unique: true
    t.index ["user_id"], name: "index_tags_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email_address", null: false
    t.string "password_digest", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email_address"], name: "index_users_on_email_address", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "bundles", "users"
  add_foreign_key "folders", "folders", column: "parent_id"
  add_foreign_key "folders", "users"
  add_foreign_key "material_tags", "materials"
  add_foreign_key "material_tags", "tags"
  add_foreign_key "materials", "bundles", on_delete: :nullify
  add_foreign_key "materials", "folders", on_delete: :nullify
  add_foreign_key "materials", "users"
  add_foreign_key "sessions", "users"
  add_foreign_key "tags", "users"
end
