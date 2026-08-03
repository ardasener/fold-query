import { useEffect, useState } from "react";
import { Button, Input, Modal, Popconfirm, Typography } from "antd";
import type { ProjectInfo } from "../../types/project";
import "./ProjectEditModal.css";

interface ProjectEditModalProps {
  project: ProjectInfo | null;
  onClose: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function ProjectEditModal({ project, onClose, onRename, onDelete }: ProjectEditModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(project?.name ?? "");
  }, [project]);

  return (
    <Modal title="Edit project" open={project !== null} onCancel={onClose} footer={null} centered>
      {project && (
        <>
          <div className="edit-field">
            <span className="edit-label">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="edit-actions">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              disabled={!name.trim() || name.trim() === project.name}
              onClick={() => {
                onRename(project.id, name.trim());
                onClose();
              }}
            >
              Save
            </Button>
          </div>
          <div className="edit-danger">
            <Typography.Text type="danger" strong>
              Danger zone
            </Typography.Text>
            <Popconfirm
              title="Delete this project?"
              description="The script and chat history will be permanently removed."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                onDelete(project.id);
                onClose();
              }}
            >
              <Button danger>Delete project</Button>
            </Popconfirm>
          </div>
        </>
      )}
    </Modal>
  );
}

export default ProjectEditModal;
