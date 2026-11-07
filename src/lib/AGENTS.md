# Library rules

- Secret Chats use an isolated, pinned vodozemac Olm prototype; real sending stays disabled until authenticated handshake, encrypted atomic storage, retry/replay and lifecycle gates pass, because static-derived epochs and static-key self-copies do not provide forward secrecy.