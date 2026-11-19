import type { PanelProps, RoomFile } from "../../app/panels";
import type { Room } from "../../app/roomStore";
import type { FilesSession, FileRequest } from "./session";
export type FilesRoom = PanelProps["room"] & Pick<Room, "filesAll">;
export type FilesProps = Omit<PanelProps, "room"> & {
  room: FilesRoom;
  session: FilesSession;
  request: FileRequest;
  onfolderchange: () => void;
  /** Opens the file in the viewer; the selected upload has been revalidated. */
  onopenfile: (file: RoomFile) => void;
};
