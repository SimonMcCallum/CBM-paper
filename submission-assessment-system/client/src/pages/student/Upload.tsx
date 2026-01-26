import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material';
import { CloudUpload, Delete, InsertDriveFile } from '@mui/icons-material';
import Layout from '../../components/Layout';
import apiClient from '../../api/client';
import { useSnackbar } from 'notistack';

export default function Upload() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Validate file type
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        enqueueSnackbar('Please select a PDF file', { variant: 'error' });
        return;
      }

      // Validate file size (50MB max)
      if (selectedFile.size > 50 * 1024 * 1024) {
        enqueueSnackbar('File size must be less than 50MB', { variant: 'error' });
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  const handleUpload = async () => {
    if (!file) {
      enqueueSnackbar('Please select a file', { variant: 'warning' });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', 'default-course');
    formData.append('assignmentId', 'default-assignment');

    try {
      const response = await apiClient.post('/submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setProgress(percent);
        },
      });

      enqueueSnackbar('Upload successful! Your submission is being processed.', { variant: 'success' });
      navigate('/student');
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Upload failed. Please try again.';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Layout title="Upload Submission">
      <Box maxWidth="md" mx="auto">
        <Typography variant="h4" gutterBottom fontWeight="bold">
          Upload Your Submission
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Instructions:</strong>
          </Typography>
          <Typography variant="body2" component="div">
            <ul style={{ marginTop: '8px', marginBottom: 0 }}>
              <li>Upload a PDF document of your work</li>
              <li>The system will analyze the content for novelty</li>
              <li>You'll receive a customized assessment based on your submission</li>
              <li>Maximum file size: 50MB</li>
            </ul>
          </Typography>
        </Alert>

        <Card>
          <CardContent>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: file ? 'primary.main' : 'grey.400',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                bgcolor: file ? 'primary.50' : 'grey.50',
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'primary.50',
                },
              }}
              onClick={() => !file && document.getElementById('file-input')?.click()}
            >
              <CloudUpload sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />

              {!file ? (
                <>
                  <Typography variant="h6" gutterBottom>
                    Click to select a PDF file
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    or drag and drop here
                  </Typography>
                </>
              ) : (
                <Paper elevation={2} sx={{ p: 2, mt: 2, display: 'inline-block', minWidth: 300 }}>
                  <List disablePadding>
                    <ListItem
                      secondaryAction={
                        <IconButton edge="end" onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}>
                          <Delete />
                        </IconButton>
                      }
                    >
                      <InsertDriveFile color="error" sx={{ mr: 2 }} />
                      <ListItemText
                        primary={file.name}
                        secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                      />
                    </ListItem>
                  </List>
                </Paper>
              )}

              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="file-input"
                disabled={uploading}
              />
            </Box>

            {uploading && (
              <Box mt={3}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="body2" color="text.secondary" align="center" mt={1}>
                  Uploading: {progress}%
                </Typography>
              </Box>
            )}

            <Box mt={3} display="flex" gap={2}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleUpload}
                disabled={!file || uploading}
                startIcon={<CloudUpload />}
              >
                {uploading ? 'Uploading...' : 'Upload and Process'}
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/student')}
                disabled={uploading}
              >
                Cancel
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Alert severity="warning" sx={{ mt: 3 }}>
          <Typography variant="body2">
            <strong>Note:</strong> After uploading, your submission will be analyzed for novelty.
            This may take 1-2 minutes. You'll be notified when your assessment is ready.
          </Typography>
        </Alert>
      </Box>
    </Layout>
  );
}
