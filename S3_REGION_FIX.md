# S3 Region Error Fix

## Error Message
```
The bucket you are attempting to access must be addressed using the specified endpoint. 
Please send all future requests to this endpoint.
```

This error means the `AWS_REGION` environment variable doesn't match your S3 bucket's actual region.

## How to Find Your Bucket's Region

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click on your bucket: `espro-collective`
3. Go to **Properties** tab
4. Scroll down to **AWS Region** - this is your bucket's region

Common regions:
- `us-east-1` (N. Virginia)
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `ap-southeast-1` (Singapore)
- etc.

## Fix in Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select **espro-backend** service
3. Go to **Environment** tab
4. Find `AWS_REGION` variable
5. Update it to match your bucket's actual region (e.g., `us-west-2`, `eu-west-1`, etc.)
6. **Redeploy** the service

## Example

If your bucket is in **Oregon (us-west-2)**:
```
AWS_REGION=us-west-2
```

If your bucket is in **Ireland (eu-west-1)**:
```
AWS_REGION=eu-west-1
```

## Verify

After updating and redeploying:
1. Check backend logs - should show: `[Storage] Using AWS S3 for file storage { bucket: 'espro-collective', region: 'your-region' }`
2. Try uploading an image - should work without the endpoint error

## All AWS Regions

Common regions you might see:
- `us-east-1` - US East (N. Virginia)
- `us-east-2` - US East (Ohio)
- `us-west-1` - US West (N. California)
- `us-west-2` - US West (Oregon)
- `eu-west-1` - Europe (Ireland)
- `eu-central-1` - Europe (Frankfurt)
- `ap-southeast-1` - Asia Pacific (Singapore)
- `ap-southeast-2` - Asia Pacific (Sydney)
- `ap-northeast-1` - Asia Pacific (Tokyo)

Check your S3 bucket properties to find the exact region code.

