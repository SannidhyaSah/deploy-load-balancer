'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, RefreshCw, Settings, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ApiKey {
  _id: string;
  key: string;
  name?: string;
  profile?: string | null;
  isActive: boolean;
  lastUsed: string | null;
  rateLimitResetAt: string | null;
  failureCount: number;
  requestCount: number;
  dailyRateLimit?: number | null;
  dailyRequestsUsed: number;
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;
}

export default function KeyStats() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<{[key: string]: boolean}>({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isWarnDialogOpen, setIsWarnDialogOpen] = useState(false);
  const [keyToToggle, setKeyToToggle] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editProfileValue, setEditProfileValue] = useState('');
  const [editRateLimitValue, setEditRateLimitValue] = useState<string>('');
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set());
  const [isBulkLimitDialogOpen, setIsBulkLimitDialogOpen] = useState(false);
  const [bulkLimitValue, setBulkLimitValue] = useState<string>('');
  const [isApplyingBulkLimit, setIsApplyingBulkLimit] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const { toast } = useToast();

  const formatKeyForDisplay = (key: any): JSX.Element | string => {
    if (!key) return <span className="text-muted-foreground italic">N/A</span>;
    
    // Convert to string if it's an object
    const keyStr = typeof key === 'object' ? String(key) : key;
    
    // Check if it's now a valid string we can work with
    if (typeof keyStr === 'string' && keyStr.length > 10) {
      return `${keyStr.substring(0, 10)}...${keyStr.substring(keyStr.length - 4)}`;
    }
    
    // If it's too short or not a proper string
    return keyStr || <span className="text-muted-foreground italic">N/A</span>;
  };

  const fetchKeys = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/keys');
      if (!response.ok) {
        throw new Error(`Error fetching keys: ${response.statusText}`);
      }
      const data = await response.json();
      setKeys(data);
    } catch (error) {
      console.error('Error fetching keys:', error);
      toast({
        title: 'Error fetching API keys',
        description: 'Failed to fetch keys from the server',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const extractProfiles = (keys: ApiKey[]): string[] => {
    const profileSet = new Set<string>();

    keys.forEach(key => {
      if (key.profile && key.profile.trim() !== '') {
        profileSet.add(key.profile.trim());
      }
    });

    return Array.from(profileSet).sort();
  };

  const groupKeysByProfile = (keys: ApiKey[]): { [profile: string]: ApiKey[] } => {
    const grouped: { [profile: string]: ApiKey[] } = {
      'Default': [] // Always include a Default group
    };

    keys.forEach(key => {
      const profile = key.profile && key.profile.trim() !== '' ? key.profile.trim() : 'Default';
      if (!grouped[profile]) {
        grouped[profile] = [];
      }
      grouped[profile].push(key);
    });

    return grouped;
  };

  const existingProfiles = extractProfiles(keys);

  const keysByProfile = groupKeysByProfile(keys);

  useEffect(() => {
    fetchKeys();
  }, []);

  const refreshData = () => {
    fetchKeys();
  };

  const getStatusBadge = (key: ApiKey) => {
    if (!key.isActive) {
      return <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>;
    }
    if (key.isDisabledByRateLimit) {
      return <Badge variant="destructive">Daily Limited</Badge>;
    }
    if (key.rateLimitResetAt && new Date(key.rateLimitResetAt) > new Date()) {
      return <Badge variant="secondary" className="text-yellow-500">Rate Limited</Badge>;
    }
    return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Active</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleDeleteKey = async () => {
    if (!selectedKeyId) return;

    try {
      const response = await fetch(`/api/admin/keys/${selectedKeyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete key');
      }

      toast({
        title: 'Key deleted',
        description: 'API key was deleted successfully',
      });

      // Refresh the keys list
      fetchKeys();
    } catch (error) {
      console.error('Error deleting key:', error);
      toast({
        title: 'Error deleting key',
        description: 'Failed to delete the API key',
        variant: 'destructive',
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const proceedWithToggle = async (keyId: string) => {
    const keyToUpdate = keys.find(k => k._id === keyId);
    if (!keyToUpdate) return;
    
    setIsToggling(prev => ({...prev, [keyId]: true}));
    
    try {
      const response = await fetch(`/api/admin/keys/${keyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !keyToUpdate.isActive,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update key status');
      }
      
      setKeys(keys.map(key =>
        key._id === keyId 
          ? {...key, isActive: !key.isActive} 
          : key
      ));
      
      toast({
        title: 'Key status updated',
        description: `API key is now ${!keyToUpdate.isActive ? 'active' : 'inactive'}`,
      });
    } catch (error) {
      console.error('Error toggling key status:', error);
      toast({
        title: 'Error updating key',
        description: 'Failed to update key status',
        variant: 'destructive',
      });
    } finally {
      setIsToggling(prev => ({...prev, [keyId]: false}));
      setIsWarnDialogOpen(false);
    }
  };

  const handleToggleKey = (keyId: string, currentStatus: boolean, isDisabledByRateLimit: boolean) => {
    if (!currentStatus && isDisabledByRateLimit) {
      setKeyToToggle(keyId);
      setIsWarnDialogOpen(true);
    } else {
      proceedWithToggle(keyId);
    }
  };

  const handleOpenEditModal = (key: ApiKey) => {
    setEditingKey(key);
    setEditNameValue(key.name || '');
    setEditProfileValue(key.profile || '');
    setEditRateLimitValue(key.dailyRateLimit !== null && key.dailyRateLimit !== undefined ? String(key.dailyRateLimit) : '');
    setIsEditDialogOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!editingKey) return;
    
    setIsSavingChanges(true);
    
    try {
      const dailyRateLimit = editRateLimitValue.trim() !== ''
        ? parseInt(editRateLimitValue, 10)
        : null;
      
      if (dailyRateLimit !== null && (isNaN(dailyRateLimit) || dailyRateLimit < 0)) {
        throw new Error('Daily rate limit must be a valid positive number');
      }
      
      const response = await fetch(`/api/admin/keys/${editingKey._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editNameValue.trim(),
          profile: editProfileValue.trim(),
          dailyRateLimit: dailyRateLimit,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update key');
      }
      
      const responseData = await response.json();
      let updatedKey = responseData.key || {};
      
      // Ensure the key has all required properties
      updatedKey = {
        ...editingKey, // Keep original properties as a base
        ...updatedKey,  // Override with the updates
      };
      
      setKeys(keys.map(key => 
        key._id === editingKey._id ? updatedKey : key
      ));
      
      toast({
        title: 'Key updated',
        description: 'Key settings were updated successfully',
      });
      
      setIsEditDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating key:', error);
      toast({
        title: 'Error updating key',
        description: error.message || 'Failed to update key',
        variant: 'destructive',
      });
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleSelectKey = (keyId: string, isSelected: boolean) => {
    const updatedSelection = new Set(selectedKeyIds);
    
    if (isSelected) {
      updatedSelection.add(keyId);
    } else {
      updatedSelection.delete(keyId);
    }
    
    setSelectedKeyIds(updatedSelection);
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      const allKeyIds = new Set(keys.map(key => key._id));
      setSelectedKeyIds(allKeyIds);
    } else {
      setSelectedKeyIds(new Set());
    }
  };

  const handleApplyBulkLimit = async () => {
    if (selectedKeyIds.size === 0) return;
    
    setIsApplyingBulkLimit(true);
    
    try {
      let rateLimit: number | null = bulkLimitValue.trim() ? parseInt(bulkLimitValue, 10) : null;
      
      if (rateLimit !== null && (isNaN(rateLimit) || rateLimit < 0)) {
        throw new Error('Daily rate limit must be a valid positive number');
      }
      
      const response = await fetch('/api/admin/keys/bulk', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyIds: Array.from(selectedKeyIds),
          action: "setLimit",
          dailyRequestLimit: rateLimit
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update keys');
      }
      
      const result = await response.json();
      
      toast({
        title: 'Keys updated',
        description: `Updated ${result.count || 0} keys with new daily rate limit`,
      });
      
      fetchKeys();
      
      setIsBulkLimitDialogOpen(false);
      
    } catch (error: any) {
      console.error('Error applying bulk limit:', error);
      toast({
        title: 'Error updating keys',
        description: error.message || 'Failed to apply bulk limit',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingBulkLimit(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedKeyIds.size === 0) return;
    
    setIsDeletingBulk(true);
    
    try {
      const response = await fetch('/api/admin/keys/bulk', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyIds: Array.from(selectedKeyIds),
          action: "delete"
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete keys');
      }
      
      const result = await response.json();
      
      toast({
        title: 'Keys deleted',
        description: `Successfully deleted ${result.count} keys`,
      });
      
      setSelectedKeyIds(new Set());
      fetchKeys();
      
      setIsBulkDeleteDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting keys:', error);
      toast({
        title: 'Error deleting keys',
        description: error.message || 'Failed to delete the selected keys',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const KeyTable = ({
    profileKeys,
    isLoading,
    selectedKeyIds,
    handleSelectKey,
    getStatusBadge,
    formatDate,
    isToggling,
    handleToggleKey,
    handleOpenEditModal,
    setSelectedKeyId,
    onDeleteOpen,
  }: {
    profileKeys: ApiKey[],
    isLoading: boolean,
    selectedKeyIds: Set<string>,
    handleSelectKey: (keyId: string, isSelected: boolean) => void,
    getStatusBadge: (key: ApiKey) => JSX.Element,
    formatDate: (dateString: string | null) => string,
    isToggling: {[key: string]: boolean},
    handleToggleKey: (keyId: string, currentStatus: boolean, isDisabledByRateLimit: boolean) => void,
    handleOpenEditModal: (key: ApiKey) => void,
    setSelectedKeyId: (id: string | null) => void,
    onDeleteOpen: () => void,
  }) => {
    const isAllProfileSelected = profileKeys.length > 0 &&
      profileKeys.every(key => selectedKeyIds.has(key._id));

    const handleSelectAllProfile = (isSelected: boolean) => {
      const newSelectedIds = new Set(selectedKeyIds);

      profileKeys.forEach(key => {
        if (isSelected) {
          newSelectedIds.add(key._id);
        } else {
          newSelectedIds.delete(key._id);
        }
      });

      setSelectedKeyIds(newSelectedIds);
    };

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={isAllProfileSelected}
                  onCheckedChange={handleSelectAllProfile}
                  disabled={profileKeys.length === 0}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Daily Usage / Limit</TableHead>
              <TableHead>Requests (Total)</TableHead>
              <TableHead>Failures</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 2 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                </TableRow>
              ))
            ) : profileKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-4 text-muted-foreground">
                  No API keys found in this profile.
                </TableCell>
              </TableRow>
            ) : (
              profileKeys.map((key) => (
                <TableRow key={key._id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedKeyIds.has(key._id)}
                      onCheckedChange={(checked) => handleSelectKey(key._id, !!checked)}
                    />
                  </TableCell>
                  <TableCell>{key.name || <span className="text-muted-foreground italic">N/A</span>}</TableCell>
                  <TableCell className="font-mono">{formatKeyForDisplay(key.key)}</TableCell>
                  <TableCell>{getStatusBadge(key)}</TableCell>
                  <TableCell>{formatDate(key.lastUsed)}</TableCell>
                  <TableCell>{key.dailyRequestsUsed} / {(key.dailyRateLimit === null || key.dailyRateLimit === undefined) ? '∞' : key.dailyRateLimit}</TableCell>
                  <TableCell>{key.requestCount}</TableCell>
                  <TableCell>{key.failureCount}</TableCell>
                  <TableCell>
                    <Switch 
                      checked={key.isActive}
                      disabled={isToggling[key._id]} 
                      onCheckedChange={() => handleToggleKey(key._id, key.isActive, key.isDisabledByRateLimit)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(key)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit Key</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:text-destructive/90"
                              onClick={() => { setSelectedKeyId(key._id); onDeleteOpen(); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete Key</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          {selectedKeyIds.size > 0 && (
            <>
              <span className="text-sm font-medium">
                {selectedKeyIds.size} selected
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsBulkLimitDialogOpen(true)}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Set Limit
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Set Daily Limit for Selected Keys</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive/90 border-destructive hover:border-destructive/90 hover:bg-destructive/10"
                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete ({selectedKeyIds.size})
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete Selected Keys</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">
            Total: {keys.length} keys
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={refreshData}
            disabled={isLoading}
            className={cn(isLoading && "opacity-80")}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Profiles</TabsTrigger>
          {existingProfiles.map(profile => (
            <TabsTrigger key={profile} value={profile}>{profile}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <KeyTable
            profileKeys={keys}
            isLoading={isLoading}
            selectedKeyIds={selectedKeyIds}
            handleSelectKey={handleSelectKey}
            getStatusBadge={getStatusBadge}
            formatDate={formatDate}
            isToggling={isToggling}
            handleToggleKey={handleToggleKey}
            handleOpenEditModal={handleOpenEditModal}
            setSelectedKeyId={setSelectedKeyId}
            onDeleteOpen={() => setIsDeleteDialogOpen(true)}
          />
        </TabsContent>
        
        {existingProfiles.map(profile => (
          <TabsContent key={profile} value={profile}>
            <KeyTable
              profileKeys={keysByProfile[profile] || []}
              isLoading={isLoading}
              selectedKeyIds={selectedKeyIds}
              handleSelectKey={handleSelectKey}
              getStatusBadge={getStatusBadge}
              formatDate={formatDate}
              isToggling={isToggling}
              handleToggleKey={handleToggleKey}
              handleOpenEditModal={handleOpenEditModal}
              setSelectedKeyId={setSelectedKeyId}
              onDeleteOpen={() => setIsDeleteDialogOpen(true)}
            />
          </TabsContent>
        ))}
      </Tabs>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={isWarnDialogOpen} onOpenChange={setIsWarnDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-yellow-500 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Warning: Key is Rate Limited
            </AlertDialogTitle>
            <AlertDialogDescription>
              This key has exceeded its daily rate limit. Enabling it will override the rate limit restriction. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => keyToToggle && proceedWithToggle(keyToToggle)}
              className="bg-yellow-500 text-white hover:bg-yellow-600"
            >
              Enable Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
            <DialogDescription>
              Update the name, profile, and daily rate limit for this key.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="key-name" className="text-right">Name</Label>
              <Input
                id="key-name"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="key-profile" className="text-right">Profile</Label>
              <Input
                id="key-profile"
                value={editProfileValue}
                onChange={(e) => setEditProfileValue(e.target.value)}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="daily-limit" className="text-right">Daily Rate Limit</Label>
              <Input
                id="daily-limit"
                type="number"
                value={editRateLimitValue}
                onChange={(e) => setEditRateLimitValue(e.target.value)}
                placeholder="Leave empty for unlimited"
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSavingChanges}>
              {isSavingChanges ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isBulkLimitDialogOpen} onOpenChange={setIsBulkLimitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Daily Rate Limit</DialogTitle>
            <DialogDescription>
              Apply a daily rate limit to {selectedKeyIds.size} selected keys.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bulk-limit" className="text-right">Daily Rate Limit</Label>
              <Input
                id="bulk-limit"
                type="number"
                value={bulkLimitValue}
                onChange={(e) => setBulkLimitValue(e.target.value)}
                placeholder="Leave empty for unlimited"
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkLimitDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyBulkLimit} disabled={isApplyingBulkLimit}>
              {isApplyingBulkLimit ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                'Apply to Selected'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedKeyIds.size} API keys? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              disabled={isDeletingBulk}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingBulk ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedKeyIds.size} Keys`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
