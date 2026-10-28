import { flattenFolders, indentedName, type FolderIndex } from '@/lib/folderTree';

type Props = {
  index: FolderIndex;
  // 選択肢から除くフォルダ（例：移動元フォルダとその子孫）
  exclude?: Set<number>;
  // 指定した深さ以上のフォルダは選べなくする（階層の上限対策）
  disableFromDepth?: number;
};

// <select> の中に、階層を字下げしたフォルダの <option> を並べる
export function FolderOptions({ index, exclude, disableFromDepth }: Props) {
  return (
    <>
      {flattenFolders(index, { exclude }).map(({ folder, depth }) => (
        <option
          key={folder.id}
          value={folder.id}
          disabled={disableFromDepth !== undefined && depth >= disableFromDepth}
        >
          {indentedName(folder.name, depth)}
        </option>
      ))}
    </>
  );
}
